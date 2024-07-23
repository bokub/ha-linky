import { HomeAssistantClient } from './ha.js';
import { LinkyClient } from './linky.js';
import { getUserConfig, MeterConfig } from './config.js';
import { getMeterHistory } from './history.js';
import { incrementSums } from './format.js';
import { computeCosts } from './cost.js';
import { debug, error, info, warn } from './log.js';
import cron from 'node-cron';
import dayjs from 'dayjs';

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

    let energyData = await getMeterHistory(config.prm);

    if (energyData.length === 0) {
      const client = new LinkyClient(config.token, config.prm, config.production);
      energyData = await client.getEnergyData(null);
    }

    if (energyData.length === 0) {
      warn(`No history found for PRM ${config.prm}`);
      return;
    }

    await haClient.saveStatistics({
      prm: config.prm,
      name: config.name,
      isProduction: config.production,
      stats: energyData,
    });

    if (config.costs) {
      const costs = computeCosts(energyData, config.costs);
      if (costs.length > 0) {
        await haClient.saveStatistics({
          prm: config.prm,
          name: config.name,
          isProduction: config.production,
          isCost: true,
          stats: costs,
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

    const lastStatistic = await haClient.findLastStatistic({
      prm: config.prm,
      isProduction: config.production,
    });
    if (!lastStatistic) {
      warn(`Data synchronization failed, no previous statistic found in Home Assistant`);
      return;
    }

    const isSyncingNeeded = dayjs(lastStatistic.start).isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6;
    if (!isSyncingNeeded) {
      debug('Everything is up-to-date, nothing to synchronize');
      return;
    }
    const client = new LinkyClient(config.token, config.prm, config.production);
    const firstDay = dayjs(lastStatistic.start).add(1, 'day');
    const energyData = await client.getEnergyData(firstDay);
    await haClient.saveStatistics({
      prm: config.prm,
      name: config.name,
      isProduction: config.production,
      stats: incrementSums(energyData, lastStatistic.sum),
    });

    if (config.costs) {
      const costs = computeCosts(energyData, config.costs);
      if (costs.length > 0) {
        const lastCostStatistic = await haClient.findLastStatistic({
          prm: config.prm,
          isProduction: config.production,
          isCost: true,
        });
        await haClient.saveStatistics({
          prm: config.prm,
          name: config.name,
          isProduction: config.production,
          isCost: true,
          stats: incrementSums(costs, lastCostStatistic?.sum || 0),
        });
      }
    }
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
