import { HomeAssistantClient } from './ha.js';
import { LinkyClient } from './linky.js';
import { getUserConfig } from './config.js';
import { debug, error, info, warn } from './log.js';
import cron from 'node-cron';
import dayjs from 'dayjs';

async function main() {
  debug('HA Linky is starting');

  const userConfig = getUserConfig();

  if (!userConfig.consumption) {
    warn('Add-on is not configured properly');
    debug('HA Linky stopped');
    return;
  }

  info('Consumption PRM ' + userConfig.consumption.prm + ' found in configuration');
  const consumptionClient = new LinkyClient(userConfig.consumption.token, userConfig.consumption.prm);

  const haClient = new HomeAssistantClient();
  await haClient.connect();

  if (userConfig.consumption.action === 'reset') {
    await haClient.purge(userConfig.consumption.prm);
    info('Statistics removed successfully!');
    haClient.disconnect();
    debug('HA Linky stopped');
    return;
  }

  async function init() {
    info(`[${dayjs().format('DD/MM HH:mm')}] New PRM detected, importing as much historical data as possible`);
    const energyData = await consumptionClient.getEnergyData(null);
    await haClient.saveStatistics(userConfig.consumption.prm, userConfig.consumption.name, energyData);
  }
  async function sync() {
    info(`[${dayjs().format('DD/MM HH:mm')}] Data synchronization started`);

    const lastStatistic = await haClient.findLastStatistic(userConfig.consumption.prm);
    if (!lastStatistic) {
      warn('Data synchronization failed, no previous statistic found in Home Assistant');
      return;
    }

    const isSyncingNeeded = dayjs(lastStatistic.start).isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6;
    if (!isSyncingNeeded) {
      debug('Everything is up to date, nothing to synchronize');
      return;
    }
    const firstDay = dayjs(lastStatistic.start).add(1, 'day');
    const energyData = await consumptionClient.getEnergyData(firstDay);
    incrementSums(energyData, lastStatistic.sum);
    await haClient.saveStatistics(userConfig.consumption.prm, userConfig.consumption.name, energyData);
  }

  const isNew = await haClient.isNewPRM(userConfig.consumption.prm);
  if (isNew) {
    await init();
  } else {
    await sync();
  }
  haClient.disconnect();

  const randomMinute = Math.floor(Math.random() * 59);
  const randomSecond = Math.floor(Math.random() * 59);

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
