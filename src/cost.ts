import { type DataPoint } from './format.js';
import { CostConfig } from './config.js';
import dayjs, { Dayjs } from 'dayjs';
import { info } from './log.js';

export type EntityHistoryData = {
  [entityId: string]: Array<{ timestamp: string; value: number; unit?: string }>;
};

export function computeCosts(
  energy: DataPoint[],
  costConfigs: CostConfig[],
  entityHistory?: EntityHistoryData,
): DataPoint[] {
  const result: DataPoint[] = [];

  for (const point of energy) {
    const matchingCostConfig = findMatchingCostConfig(point, costConfigs);

    if (matchingCostConfig) {
      let price: number | null = null;

      // If config has entity_id, use entity history data
      if (matchingCostConfig.entity_id && entityHistory) {
        price = findPriceFromEntityHistory(point, matchingCostConfig.entity_id, entityHistory);
        if (price === null) {
          continue;
        }
      } else if (matchingCostConfig.price !== undefined) {
        // Otherwise use static price
        price = matchingCostConfig.price;
      } else {
        continue;
      }

      result.push({
        date: point.date,
        value: Math.round(price * point.value) / 1000, // Convert Wh to kWh
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

function findPriceFromEntityHistory(
  point: DataPoint,
  entityId: string,
  entityHistory: EntityHistoryData,
): number | null {
  const history = entityHistory[entityId];
  if (!history || history.length === 0) {
    return null;
  }

  const pointTime = dayjs(point.date);

  // Find the most recent price at or before the data point timestamp
  let lastValidPrice: number | null = null;
  let lastValidUnit: string | undefined = undefined;

  for (const entry of history) {
    const entryTime = dayjs(entry.timestamp);
    if (entryTime.isAfter(pointTime)) {
      break; // We've passed the point in time
    }
    lastValidPrice = entry.value;
    lastValidUnit = entry.unit;
  }

  if (lastValidPrice === null) {
    return null;
  }

  // Convert price based on unit
  return convertPriceUnit(lastValidPrice, lastValidUnit);
}

function convertPriceUnit(price: number, unit: string | undefined): number {
  if (!unit) {
    return price;
  }

  const lowerUnit = unit.toLowerCase();

  // Handle cents (c€/kWh, cent/kWh, ¢/kWh, etc.)
  if (lowerUnit.includes('c€') || lowerUnit.includes('cent') || lowerUnit.includes('¢')) {
    return price / 100;
  }

  // Handle EUR/MWh (need to divide by 1000)
  if (lowerUnit.includes('eur/mwh') || lowerUnit.includes('€/mwh')) {
    return price / 1000;
  }

  // Handle cents/MWh (need to divide by 100000)
  if (lowerUnit.includes('cent/mwh') || lowerUnit.includes('c€/mwh')) {
    return price / 100000;
  }

  // Default: assume €/kWh
  return price;
}

function findMatchingCostConfig(point: DataPoint, configs: CostConfig[]): CostConfig | undefined {
  return configs.find((config) => {
    // Config must have either price or entity_id
    if (!config.price && !config.entity_id) {
      return false;
    }
    const pointStart = dayjs(point.date);
    if (!isInDateRange(pointStart, config)) {
      return false;
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

function isInDateRange(date: Dayjs, config: CostConfig): boolean {
  if (config.start_date && date.isBefore(dayjs(config.start_date))) {
    return false;
  }
  if (config.end_date && !date.isBefore(dayjs(config.end_date))) {
    return false;
  }
  return true;
}

// Add fixed daily costs (e.g. subscription) to hourly costs, once per day, in the first hour of the day.
// Must run after groupDataPointsByHour, which averages the values of an hour.
export function addDailyFees(hourlyCosts: DataPoint[], costConfigs: CostConfig[]): DataPoint[] {
  const feeConfigs = costConfigs.filter((config) => config.daily_fee);
  if (feeConfigs.length === 0) {
    return hourlyCosts;
  }

  const result = hourlyCosts.map((point) => ({ ...point }));
  const days = new Set(result.map((point) => dayjs(point.date).startOf('day').format('YYYY-MM-DDTHH:mm:ssZ')));
  for (const day of days) {
    const feeConfig = feeConfigs.find((config) => isInDateRange(dayjs(day), config));
    if (!feeConfig) {
      continue;
    }
    const firstHour = result.find((point) => dayjs(point.date).isSame(day));
    if (firstHour) {
      firstHour.value = Math.round(10000 * (firstHour.value + feeConfig.daily_fee)) / 10000;
    } else {
      result.push({ date: day, value: feeConfig.daily_fee });
    }
  }

  return result.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
}
