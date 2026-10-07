import dayjs from 'dayjs';

export type LinkyRawPoint = { v: string | null; d: string; p?: string; n?: string; iv?: string; ec?: string };
export type LinkyApiResponse = { grandeur?: Array<{ points?: LinkyRawPoint[] }> };
export type HistoryRawPoint = { debut: string; kW: string }; // Result from history CSV file

export type DataPoint = { date: string; value: number }; // Standardized data point. Date is in ISO 8601 format and represents the start of the interval. Value can be W, Wh or EUR.
export type StatisticDataPoint = { start: string; state: number; sum: number }; // Data point formatted for Home Assistant statistics

export function extractLinkyPoints(data: LinkyApiResponse | LinkyRawPoint[] | undefined): LinkyRawPoint[] {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.grandeur)) {
    return data.grandeur.flatMap((g) => (Array.isArray(g.points) ? g.points : []));
  }

  return [];
}

export function getPointValue(point: LinkyRawPoint): string {
  return point.v ?? '0';
}

export function getPointDate(point: LinkyRawPoint): string {
  return point.d;
}

export function getPointInterval(point: LinkyRawPoint): string | undefined {
  return point.p;
}

export function parseIntervalLength(interval: string | undefined): number {
  if (!interval) {
    return 1;
  }

  const normalized = interval.toUpperCase();

  if (normalized.includes('H') || normalized.includes('M') || normalized.includes('D')) {
    const hours = Number(normalized.match(/(\d+)H/)?.[1] ?? '0');
    const minutes = Number(normalized.match(/(\d+)M/)?.[1] ?? '0');
    const days = Number(normalized.match(/(\d+)D/)?.[1] ?? '0');
    return days * 24 * 60 + hours * 60 + minutes;
  }

  const match = normalized.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

export function formatDailyData(data: LinkyRawPoint[]): DataPoint[] {
  return data.map((r) => ({
    value: Number(getPointValue(r)),
    date: dayjs(getPointDate(r)).format('YYYY-MM-DDTHH:mm:ssZ'),
  }));
}

export function formatHistoryFile(data: HistoryRawPoint[]): DataPoint[] {
  return data.map((r) => ({
    value: Number(r.kW.replace(',', '.').replace('null', '0')) * 1000, // Convert kW to W
    date: dayjs(r.debut).format('YYYY-MM-DDTHH:mm:ssZ'),
  }));
}

export function formatLoadCurve(data: LinkyRawPoint[]): DataPoint[] {
  return data.map((r) => ({
    value: Number(getPointValue(r)),
    date: dayjs(getPointDate(r))
      .subtract(parseIntervalLength(getPointInterval(r)), 'minute')
      .format('YYYY-MM-DDTHH:mm:ssZ'),
  }));
}

// Group data points by hour and compute the average value for each hour
// Round result to 2 decimal places
export function groupDataPointsByHour(data: DataPoint[]): DataPoint[] {
  const grouped = data.reduce(
    (acc, cur) => {
      const date = dayjs(cur.date).startOf('hour').format('YYYY-MM-DDTHH:mm:ssZ');
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

export function formatAsStatistics(data: DataPoint[]): StatisticDataPoint[] {
  const result: StatisticDataPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    result[i] = {
      start: data[i].date,
      state: data[i].value,
      sum: data[i].value + (i === 0 ? 0 : result[i - 1].sum),
    };
  }

  return result;
}

export function incrementSums(data: StatisticDataPoint[], value: number): StatisticDataPoint[] {
  return data.map((item) => ({ ...item, sum: item.sum + value }));
}
