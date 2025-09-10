import dayjs from 'dayjs';

export type EcuDataPoint = { date: string; value: number };
export type ApsDataPoint = { ecuId: string; datas: EcuDataPoint[] };
export type StatisticDataPoint = { start: string; state: number; sum: number };

export function formatHourlyData(dayStr: string, data: number[]): EcuDataPoint[] {
  const datas: EcuDataPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const value = data[hour] ?? 0; // if no value, use 0
    datas.push({
      date: dayjs(dayStr).hour(hour).minute(0).second(0).format(),
      value,
    });
  }

  return datas;
}

export function formatDailyData(monthStr: string, data: number[]): EcuDataPoint[] {
  const datas: EcuDataPoint[] = [];
  const firstDay: Dayjs = dayjs(monthStr);
  const daysInMonth: number = firstDay.daysInMonth();

  for (let day = 1; day <= daysInMonth; day++) {
    const value = data[day-1] ?? 0; // if no value, use 0
    datas.push({
      date: dayjs(monthStr).day(day).hour(0).minute(0).second(0).format(),
      value,
    });
  }

  return datas;
}

export function formatAsStatistics(data: ApsDataPoint[]): StatisticDataPoint[] {
  return null;
}

