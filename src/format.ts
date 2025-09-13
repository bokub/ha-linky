import dayjs from 'dayjs';

export type EcuDataPoint = { date: string; value: number };
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
  const firstDay = dayjs(monthStr);
  const daysInMonth = firstDay.daysInMonth();

  for (let day = 1; day <= daysInMonth; day++) {
    const value = data[day-1] ?? 0; // if no value, use 0
    datas.push({
      date: dayjs(monthStr).date(day).hour(0).minute(0).second(0).format(),
      value,
    });
  }

  return datas;
}

export function formatAsStatistics(data: EcuDataPoint[]): StatisticDataPoint[] {
  const result: StatisticDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    result[i] = {
      start: data[i].date,
      state: data[i].value * 1000, //Value in Watt/h
      sum: (data[i].value * 1000) + (i === 0 ? 0 : result[i - 1].sum),
    };
  }

  return result;
}

