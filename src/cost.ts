import { StatisticDataPoint } from './format.js';
import { CostConfig } from './config.js';
import dayjs from 'dayjs';
import { info } from './log.js';

export function computeCosts(energy: StatisticDataPoint[], costConfigs: CostConfig[]): StatisticDataPoint[] {
  const result: StatisticDataPoint[] = [];

  for (const point of energy) {
    const matchingCostConfig = findMatchingCostConfig(point, costConfigs);
    if (matchingCostConfig) {
      const cost = Math.round(matchingCostConfig.price * point.state) / 1000;
      result.push({
        start: point.start,
        state: cost,
        sum: Math.round(1000 * ((result.length === 0 ? 0 : result[result.length - 1].sum) + cost)) / 1000,
      });
    }
  }

  if (result.length > 0) {
    const intervalFrom = dayjs(result[0].start).format('DD/MM/YYYY');
    const intervalTo = dayjs(result[result.length - 1].start).format('DD/MM/YYYY');
    info(`Successfully computed the cost of ${result.length} data points from ${intervalFrom} to ${intervalTo}`);
  }

  return result;
}

function findMatchingCostConfig(point: StatisticDataPoint, configs: CostConfig[]): CostConfig {
  return configs.find((config) => {
    if (!config.price || typeof config.price !== 'number') {
      return false;
    }
    const pointStart = dayjs(point.start);
    if (config.start_date) {
      const configStartDate = dayjs(config.start_date);
      if (pointStart.isBefore(configStartDate)) {
        return false;
      }
    }
    if (config.end_date) {
      const configEndDate = dayjs(config.end_date);
      if (pointStart.isAfter(configEndDate) || pointStart.isSame(configEndDate)) {
        return false;
      }
    }

    if (config.weekday && config.weekday.length > 0) {
      const weekday = pointStart.format('ddd').toLowerCase();
      if (!(config.weekday as string[]).includes(weekday)) {
        return false;
      }
    }

    if (config.after) {
      const afterHour = +config.after.split(':')[0];
      if (isNaN(afterHour) || pointStart.hour() < afterHour) {
        return false;
      }
    }

    if (config.before) {
      const beforeHour = +config.before.split(':')[0];
      if (isNaN(beforeHour) || pointStart.hour() >= beforeHour) {
        return false;
      }
    }

    return true;
  });
}
