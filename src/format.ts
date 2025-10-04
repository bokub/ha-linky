import dayjs from 'dayjs';

/**
 * Represents a single hourly or daily data point for an ECU.
 */
export type EcuDataPoint = { date: string; value: number };

/**
 * Represents a statistic data point used in Home Assistant.
 * 'state' is the instantaneous value in Wh and 'sum' is the cumulative sum.
 */
export type StatisticDataPoint = { start: string; state: number; sum: number };

/**
 * Formats raw hourly energy data into an array of EcuDataPoint objects.
 *
 * @param dayStr - The day in 'YYYY-MM-DD' format.
 * @param data - Array of 24 hourly values.
 * @returns Array of EcuDataPoint with each hour of the day.
 */
export function formatHourlyData(dayStr: string, data: number[]): EcuDataPoint[] {
  const datas: EcuDataPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const value = data[hour] ?? 0; // Use 0 if no value is provided
    datas.push({
      date: dayjs(dayStr).hour(hour).minute(0).second(0).format(), // Full ISO timestamp
      value,
    });
  }

  return datas;
}

/**
 * Formats raw daily energy data into an array of EcuDataPoint objects.
 *
 * @param monthStr - The month in 'YYYY-MM' format.
 * @param data - Array of daily values for the month.
 * @returns Array of EcuDataPoint with each day of the month.
 */
export function formatDailyData(monthStr: string, data: number[]): EcuDataPoint[] {
  const datas: EcuDataPoint[] = [];
  const firstDay = dayjs(monthStr);
  const daysInMonth = firstDay.daysInMonth(); // Total days in the month

  for (let day = 1; day <= daysInMonth; day++) {
    const value = data[day - 1] ?? 0; // Default to 0 if missing
    datas.push({
      date: dayjs(monthStr).date(day).hour(0).minute(0).second(0).format(),
      value,
    });
  }

  return datas;
}

/**
 * Converts an array of EcuDataPoint into Home Assistant statistics format.
 *
 * @param data - Array of EcuDataPoint objects.
 * @returns Array of StatisticDataPoint objects with state and cumulative sum.
 */
export function formatAsStatistics(data: EcuDataPoint[]): StatisticDataPoint[] {
  const result: StatisticDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    result[i] = {
      start: data[i].date,
      state: data[i].value * 1000, // Convert kWh to Wh
      sum: data[i].value * 1000 + (i === 0 ? 0 : result[i - 1].sum), // Cumulative sum
    };
  }

  return result;
}

/**
 * Increment cumulative sums in an array of StatisticDataPoint by a given value.
 *
 * @param data - Array of StatisticDataPoint objects.
 * @param value - Value to add to each sum.
 * @returns New array of StatisticDataPoint with updated sums.
 */
export function incrementSums(
  data: StatisticDataPoint[],
  value: number,
): StatisticDataPoint[] {
  return data.map((item) => ({ ...item, sum: item.sum + value }));
}
