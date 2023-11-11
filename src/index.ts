import { HomeAssistantClient } from './ha.js';
import { LinkyClient } from './linky.js';
import { getUserConfig } from './config.js';
import { debug, error, info, warn } from './log.js';
import cron from 'node-cron';
import dayjs from 'dayjs';

async function main() {
  debug('HA Linky is starting');

  const userConfig = getUserConfig();

  if (!userConfig.consumption && userConfig.consumption.sync) {
    warn('Add-on consumption is not configured properly');
    debug('HA Linky stopped');
    return;
  }
  if (!userConfig.production && userConfig.production.sync) {
    warn('Add-on production is not configured properly');
    debug('HA Linky stopped');
    return;
  }
  let consumptionClient;
  let productionClient;

  if (userConfig.consumption.sync) {
    info('consumption PRM ' + userConfig.consumption.prm + ' found in configuration');
    consumptionClient = new LinkyClient(userConfig.consumption.token, userConfig.consumption.prm);
  }
  if (userConfig.production.sync) {
    info('production PRM ' + userConfig.production.prm + ' found in configuration');
    productionClient = new LinkyClient(userConfig.production.token, userConfig.production.prm);
  }
  const haClient = new HomeAssistantClient();
  await haClient.connect();

  if (userConfig.consumption.action === 'reset') {
    await haClient.purge(userConfig.consumption.prm);
    info('Statistics removed successfully for consumption!');
  }
  if (userConfig.production.action === 'reset') {
    await haClient.purge(userConfig.production.prm + 'p');
    info('Statistics removed successfully for production!');
  }
  if (userConfig.production.action === 'reset' || userConfig.consumption.action === 'reset') {
    haClient.disconnect();
    debug('HA Linky stopped');
    return;
  }

  async function init() {
    info(`[${dayjs().format('DD/MM HH:mm')}] New PRM detected, importing as much historical data as possible`);
    if (userConfig.consumption.sync) {
      const energyData = await consumptionClient.getEnergyData(null, false);
      await haClient.saveStatistics(userConfig.consumption.prm, userConfig.consumption.name, energyData);
    }
    if (userConfig.production.sync) {
      const energyData = await productionClient.getEnergyData(null, true);
      await haClient.saveStatistics(userConfig.production.prm + 'p', userConfig.production.name, energyData);
    }
  }
  async function sync() {
    let lastStatisticC = null;
    if (userConfig.consumption.sync) {
      info(`[${dayjs().format('DD/MM HH:mm')}] Data synchronization started consumption`);
      lastStatisticC = await haClient.findLastStatistic(userConfig.consumption.prm);
      if (!lastStatisticC) {
        warn('Data synchronization failed, no previous statistic found in Home Assistant for consumption');
        return;
      }
    }
    let lastStatisticP = null;
    if (userConfig.production.sync) {
      info(`[${dayjs().format('DD/MM HH:mm')}] Data synchronization started production`);
      lastStatisticP = await haClient.findLastStatistic(userConfig.production.prm + 'p');
      if (!lastStatisticP) {
        warn('Data synchronization failed, no previous statistic found in Home Assistant for production');
        return;
      }
    }

    let isSyncingNeededC = false;
    if (userConfig.consumption.sync) {
      isSyncingNeededC = dayjs(lastStatisticC.start).isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6;
    }
    let isSyncingNeededP = false;
    if (userConfig.production.sync) {
      isSyncingNeededP = dayjs(lastStatisticP.start).isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6;
    }

    if (!isSyncingNeededC && !isSyncingNeededP && (userConfig.consumption.sync || userConfig.production.sync)) {
      debug('Everything is up to date, nothing to synchronize');
      return;
    }
    if (isSyncingNeededC) {
      const firstDay = dayjs(lastStatisticC.start).add(1, 'day');
      const energyData = await consumptionClient.getEnergyData(firstDay, false);
      incrementSums(energyData, lastStatisticC.sum);
      await haClient.saveStatistics(userConfig.consumption.prm, userConfig.consumption.name, energyData);
    }
    if (isSyncingNeededP) {
      const firstDay = dayjs(lastStatisticP.start).add(1, 'day');
      const energyData = await productionClient.getEnergyData(firstDay, true);
      incrementSums(energyData, lastStatisticP.sum);
      await haClient.saveStatistics(userConfig.production.prm + 'p', userConfig.production.name, energyData);
    }
  }

  let isNewC = false;
  let isNewP = false;
  if (userConfig.consumption.sync) {
    isNewC = await haClient.isNewPRM(userConfig.consumption.prm);
  }
  if (userConfig.production.sync) {
    isNewP = await haClient.isNewPRM(userConfig.production.prm + 'p');
  }
  if (isNewP || isNewC) {
    await init();
  } else {
    await sync();
  }
  haClient.disconnect();

  const randomMinute = Math.floor(Math.random() * 59);
  const randomSecond = Math.floor(Math.random() * 59);

  if (userConfig.consumption.sync || userConfig.production.sync) {
    info(
      `Data synchronization planned every day at ` +
        `06:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')} and ` +
        `09:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')}`,
    );

    cron.schedule(`${randomSecond} ${randomMinute} 6,9 * * *`, async () => {
      await haClient.connect();
      await sync();
      haClient.disconnect();
    });
  }
}

function incrementSums(data: { sum: number }[], value: number) {
  return data.map((item) => {
    item.sum += value;
    return item;
  });
}

try {
  await main();
} catch (e) {
  error(e.toString());
  process.exit(1);
}
