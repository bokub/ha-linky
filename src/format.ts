import dayjs from 'dayjs';

export type LinkyDataPoint = { date: string; value: number };
export type EnergyDataPoint = { start: string; state: number; sum: number };

export function formatDailyData(data: { value: string; date: string }[]): LinkyDataPoint[] {
  return data.map((r) => ({
    value: +r.value,
    date: dayjs(r.date).format('YYYY-MM-DDTHH:mm:ssZ'),
  }));
}

export function formatLoadCurve(data: { value: string; date: string; interval_length?: string }[]): LinkyDataPoint[] {
  const formatted = data.map((r) => ({
    value: +r.value,
    date: dayjs(r.date)
      .subtract(parseFloat(r.interval_length?.match(/\d+/)[0] || '1'), 'minute')
      .startOf('hour')
      .format('YYYY-MM-DDTHH:mm:ssZ'),
  }));

  const grouped = formatted.reduce(
    (acc, cur) => {
      const date = cur.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(cur.value);
      return acc;
    },
    {} as { [date: string]: number[] },
  );
  return Object.entries(grouped).map(([date, values]) => ({
    date,
    value: Math.round((100 * values.reduce((acc, cur) => acc + cur, 0)) / values.length) / 100,
  }));
}

export function formatToEnergy(data: LinkyDataPoint[]): EnergyDataPoint[] {
  const result: EnergyDataPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    result[i] = {
      start: data[i].date,
      state: data[i].value,
      sum: data[i].value + (i === 0 ? 0 : result[i - 1].sum),
    };
  }

  return result;
}
