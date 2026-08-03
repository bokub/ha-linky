import { HomeAssistantClient } from './ha.js';
import { LinkyClient } from './linky.js';
import { getUserConfig, MeterConfig } from './config.js';
import { getMeterHistory } from './history.js';
import {
  formatAsStatistics,
  groupDataPointsByHour,
  incrementSums,
  asDataPoints,
  coverExistingHours,
  findFirstDayToReimport,
  mergeByDay,
  sumBefore,
  DataPoint,
} from './format.js';
import { computeCosts, EntityHistoryData } from './cost.js';
import { debug, error, info, warn } from './log.js';
import cron from 'node-cron';
import dayjs from 'dayjs';

const GAP_WINDOW_DAYS = 30;
const UPGRADE_WINDOW_DAYS = 7;

async function main() {
  debug('HA Linky is starting');

  const userConfig = getUserConfig();

  // Stop if configuration is empty
  if (userConfig.meters.length === 0) {
    warn('Add-on is not configured properly');
    debug('HA Linky stopped');
    return;
  }

  const haClient = new HomeAssistantClient();
  await haClient.connect();

  // Reset statistics if needed
  for (const config of userConfig.meters) {
    if (config.action === 'reset') {
      await haClient.purge(config.prm, config.production);
      info(`Statistics removed successfully for PRM ${config.prm} !`);
    }
  }

  // Stop if nothing else to do
  if (userConfig.meters.every((config) => config.action !== 'sync')) {
    haClient.disconnect();
    info('Nothing to sync');
    debug('HA Linky stopped');
    return;
  }

  async function init(config: MeterConfig) {
    info(
      `[${dayjs().format('DD/MM HH:mm')}] New PRM detected, historical ${
        config.production ? 'production' : 'consumption'
      } data import is starting`,
    );

    let energyData = await getMeterHistory(config.prm, config.production);

    if (energyData.length === 0) {
      const client = new LinkyClient(config.token, config.prm, config.production);
      energyData = await client.getEnergyData(null);
    }

    if (energyData.length === 0) {
      warn(`No history found for PRM ${config.prm}`);
      return;
    }
    const energyStatistics = formatAsStatistics(groupDataPointsByHour(energyData));

    await haClient.saveStatistics({
      prm: config.prm,
      name: config.name,
      isProduction: config.production,
      stats: energyStatistics,
    });

    if (config.costs) {
      const entityHistory = await fetchEntityHistory(haClient, config.costs, energyData);
      const costs = computeCosts(energyData, config.costs, entityHistory);
      const costsStatistics = formatAsStatistics(groupDataPointsByHour(costs));

      if (costsStatistics.length > 0) {
        await haClient.saveStatistics({
          prm: config.prm,
          name: config.name,
          isProduction: config.production,
          isCost: true,
          stats: costsStatistics,
        });
      }
    }
  }

  async function sync(config: MeterConfig) {
    info(
      `[${dayjs().format('DD/MM HH:mm')}] Synchronization started for ${
        config.production ? 'production' : 'consumption'
      } data`,
    );

    const statistics = await haClient.getHourlyStatistics({
      prm: config.prm,
      isProduction: config.production,
      days: GAP_WINDOW_DAYS,
    });
    const lastStatistic = statistics[statistics.length - 1];
    if (!lastStatistic) {
      warn(`Data synchronization failed, no previous statistic found in Home Assistant`);
      return;
    }

    const lastDay = dayjs(lastStatistic.start).startOf('day');
    const incompleteDay = findFirstDayToReimport(statistics, dayjs().subtract(UPGRADE_WINDOW_DAYS, 'days'));
    const isSyncingNeeded = !!incompleteDay || (lastDay.isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6);
    if (!isSyncingNeeded) {
      debug('Everything is up-to-date, nothing to synchronize');
      return;
    }

    // Statistic sums are cumulative, so re-importing a past day means re-importing everything after it
    const firstDay = incompleteDay ?? lastDay.add(1, 'day');
    if (incompleteDay) {
      info(`Incomplete data detected on ${incompleteDay.format('DD/MM/YYYY')}, re-importing from that day`);
    }

    const client = new LinkyClient(config.token, config.prm, config.production);
    let energyData = await client.getEnergyData(firstDay);

    if (incompleteDay) {
      const fetchedDay = energyData.filter((point) => dayjs(point.date).isSame(incompleteDay, 'day'));
      if (fetchedDay.every((point) => !point.value)) {
        warn(`Enedis has no data at all for ${incompleteDay.format('DD/MM/YYYY')}, this day cannot be recovered yet`);
      } else if (fetchedDay.length === 1) {
        debug(
          `Only the daily total is available for ${incompleteDay.format('DD/MM/YYYY')}, hourly detail may never come`,
        );
      }

      const existing = asDataPoints(statistics.filter((point) => !dayjs(point.start).isBefore(firstDay)));
      energyData = coverExistingHours(mergeByDay(existing, energyData), existing);
    }

    const energyStatistics = formatAsStatistics(groupDataPointsByHour(energyData));

    await haClient.saveStatistics({
      prm: config.prm,
      name: config.name,
      isProduction: config.production,
      stats: incrementSums(energyStatistics, sumBefore(statistics, firstDay)),
    });

    if (config.costs) {
      const entityHistory = await fetchEntityHistory(haClient, config.costs, energyData);
      const costs = computeCosts(energyData, config.costs, entityHistory);
      const costsStatistics = formatAsStatistics(groupDataPointsByHour(costs));

      if (costsStatistics.length > 0) {
        const costStatistics = await haClient.getHourlyStatistics({
          prm: config.prm,
          isProduction: config.production,
          isCost: true,
          days: GAP_WINDOW_DAYS,
        });
        await haClient.saveStatistics({
          prm: config.prm,
          name: config.name,
          isProduction: config.production,
          isCost: true,
          stats: incrementSums(costsStatistics, sumBefore(costStatistics, firstDay)),
        });
      }
    }
  }

  async function fetchEntityHistory(
    haClient: HomeAssistantClient,
    costConfigs: MeterConfig['costs'],
    energyData: DataPoint[],
  ): Promise<EntityHistoryData | undefined> {
    if (!costConfigs || costConfigs.length === 0) {
      return undefined;
    }

    // Extract unique entity IDs from cost configs
    const entityIds = [...new Set(costConfigs.filter((c) => c.entity_id).map((c) => c.entity_id!))];

    if (entityIds.length === 0) {
      return undefined;
    }

    // Determine time range from energy data
    const startTime = dayjs(energyData[0].date).subtract(1, 'day').toISOString();
    const endTime = dayjs(energyData[energyData.length - 1].date)
      .add(1, 'day')
      .toISOString();

    const entityHistory: EntityHistoryData = {};

    for (const entityId of entityIds) {
      try {
        const history = await haClient.getEntityHistory({
          entityId,
          startTime,
          endTime,
        });
        entityHistory[entityId] = history;
      } catch (e) {
        warn(`Failed to fetch history for entity ${entityId}: ${e.toString()}`);
        entityHistory[entityId] = [];
      }
    }

    return entityHistory;
  }

  // Initialize or sync data
  for (const config of userConfig.meters) {
    if (config?.action === 'sync') {
      info(`PRM ${config.prm} found in configuration for ${config.production ? 'production' : 'consumption'}`);

      const isNew = await haClient.isNewPRM({
        prm: config.prm,
        isProduction: config.production,
      });
      if (isNew) {
        await init(config);
      } else {
        await sync(config);
      }
    }
  }

  haClient.disconnect();

  // Setup cron job
  const randomMinute = Math.floor(Math.random() * 59);
  const randomSecond = Math.floor(Math.random() * 59);

  info(
    `Data synchronization planned every day at ` +
      `06:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')} and ` +
      `09:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')}`,
  );

  cron.schedule(`${randomSecond} ${randomMinute} 6,9 * * *`, async () => {
    await haClient.connect();
    for (const config of userConfig.meters) {
      if (config.action === 'sync') {
        await sync(config);
      }
    }

    haClient.disconnect();
  });
}

try {
  await main();
} catch (e) {
  error(e.toString());
  process.exit(1);
}
