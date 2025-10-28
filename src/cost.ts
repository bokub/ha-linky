import { type DataPoint } from './format.js';
import { CostConfig } from './config.js';
import dayjs from 'dayjs';
import { info } from './log.js';

export function computeCosts(energy: DataPoint[], costConfigs: CostConfig[]): DataPoint[] {
  const result: DataPoint[] = [];

  for (const point of energy) {
    const matchingCostConfig = findMatchingCostConfig(point, costConfigs);

    if (matchingCostConfig) {
      result.push({
        date: point.date,
        value: Math.round(matchingCostConfig.price * point.value) / 1000, // Convert Wh to kWh
      });
    }
  }

  if (result.length > 0) {
    const intervalFrom = dayjs(result[0].date).format('DD/MM/YYYY');
    const intervalTo = dayjs(result[result.length - 1].date).format('DD/MM/YYYY');
    info(`Successfully computed the cost of ${result.length} data points from ${intervalFrom} to ${intervalTo}`);
  } else {
    info(
      `No cost computed for the ${energy.length} points. No matching cost configuration found (out of ${costConfigs.length})`,
    );
  }

  return result;
}

function findMatchingCostConfig(point: DataPoint, configs: CostConfig[]): CostConfig {
  return configs.find((config) => {
    if (!config.price || typeof config.price !== 'number') {
      return false;
    }
    const pointStart = dayjs(point.date);
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
      const split = config.after.split(':');
      const afterHour = +split[0];
      if (isNaN(afterHour) || pointStart.hour() < afterHour) {
        return false;
      }
      const afterMinutes = +split[1];
      if (pointStart.hour() === afterHour && pointStart.minute() < afterMinutes) {
        return false;
      }
    }

    if (config.before) {
      const split = config.before.split(':');
      const beforeHour = +split[0];
      if (isNaN(beforeHour) || pointStart.hour() > beforeHour) {
        return false;
      }
      const beforeMinutes = +split[1];
      if (pointStart.hour() === beforeHour && pointStart.minute() >= beforeMinutes) {
        return false;
      }
    }

    return true;
  });
}
