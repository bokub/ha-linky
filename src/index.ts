import process from 'node:process';
import { getUserConfig, MeterConfig } from './config.js';
import { ApsystemsClient } from './apsystems.js';
import { HomeAssistantClient } from './ha.js';
import { incrementSums } from './format.js';
import { debug, error, info, warn } from './log.js';
import cron from 'node-cron';
import dayjs from 'dayjs';

async function main() {
  debug('HA APSystems is starting');

  const userConfig = getUserConfig();
  debug(`User config = ${JSON.stringify(userConfig, null, 3)}`);

  if (!isValidConfig(userConfig)) {
    warn('Add-on is not configured properly');
    debug('HA APSystems stopped');
    return;
  }

  const haClient = new HomeAssistantClient();
  await haClient.connect();

  await handleResets(userConfig, haClient);

  if (nothingToSync(userConfig)) {
    haClient.disconnect();
    info('Nothing to sync');
    debug('HA APSystems stopped');
    return;
  }

  const apClient = new ApsystemsClient(userConfig.api.appId, userConfig.api.appSecret);
  await handleSyncs(userConfig, haClient, apClient);

  haClient.disconnect();

  scheduleJobs(userConfig);
}

function isValidConfig(userConfig) {
  return userConfig.meters.length > 0 && userConfig.api !== null;
}

async function handleResets(userConfig, haClient) {
  for (const config of userConfig.meters) {
    if (config.action === 'reset') {
      await haClient.purge(config.systemId, config.ecuId);
      info(`Statistics removed for ${config.systemId}/${config.ecuId}`);
    }
  }
}

function nothingToSync(userConfig) {
  return userConfig.meters.every((m) => m.action !== 'sync');
}

async function handleSyncs(userConfig, haClient, apClient) {
  for (const config of userConfig.meters) {
    if (config.action === 'sync') {
      info(`SystemId/EcuId ${config.systemId}/${config.ecuId} found in configuration`);

      const isNew = await haClient.isNewPRM(config.systemId, config.ecuId);
      if (isNew) {
        await initMeter(config, haClient, apClient);
      } else {
        await syncMeter(config, haClient, apClient);
      }
    }
  }
}

async function initMeter(
  config: MeterConfig,
  haClient: HomeAssistantClient,
  apClient: ApsystemsClient,
) {
  info(
    `[${dayjs().format('DD/MM HH:mm')}] New SystemId/EcuId detected, historical data import is starting`,
  );

  const energyData = await apClient.getEnergyData(config.systemId, config.ecuId, null);

  if (energyData.length === 0) {
    warn(`No history found for ${config.systemId}/${config.ecuId}`);
    return;
  }

  await haClient.saveStatistics({
    systemId: config.systemId,
    ecuId: config.ecuId,
    name: config.name,
    stats: energyData,
  });
}

async function syncMeter(
  config: MeterConfig,
  haClient: HomeAssistantClient,
  apClient: ApsystemsClient,
) {
  info(
    `[${dayjs().format('DD/MM HH:mm')}] Synchronization started for ${config.systemId}/${config.ecuId}`,
  );

  const lastStatistic = await haClient.findLastStatistic(config.systemId, config.ecuId);
  if (!lastStatistic) {
    warn(
      `No previous statistic found in Home Assistant for ${config.systemId}/${config.ecuId}`,
    );
    return;
  }

  const isSyncingNeeded =
    dayjs(lastStatistic.start).isBefore(dayjs().subtract(2, 'days')) &&
    dayjs().hour() >= 6;

  if (!isSyncingNeeded) {
    debug(`Up-to-date: nothing to sync for ${config.systemId}/${config.ecuId}`);
    return;
  }

  const firstDay = dayjs(lastStatistic.start).add(1, 'day');
  const energyData = await apClient.getEnergyData(
    config.systemId,
    config.ecuId,
    firstDay,
  );

  await haClient.saveStatistics({
    systemId: config.systemId,
    ecuId: config.ecuId,
    name: config.name,
    stats: incrementSums(energyData, lastStatistic.sum),
  });
}

function scheduleJobs(userConfig) {
  const randomMinute = Math.floor(Math.random() * 59);
  const randomSecond = Math.floor(Math.random() * 59);

  info(
    `Data synchronization scheduled every day at ` +
      `06:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')} and ` +
      `09:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')}`,
  );

  cron.schedule(`${randomSecond} ${randomMinute} 6,9 * * *`, async () => {
    const haClient = new HomeAssistantClient();
    const apClient = new ApsystemsClient(userConfig.api.appId, userConfig.api.appSecret);

    await haClient.connect();
    for (const config of userConfig.meters) {
      if (config.action === 'sync') {
        await syncMeter(config, haClient, apClient);
      }
    }
    haClient.disconnect();
  });
}

try {
  await main();
} catch (e) {
  error('Fatal error in main: ' + (e instanceof Error ? e.stack : e));
  process.exit(1);
}
