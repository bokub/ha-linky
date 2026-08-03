import dayjs from 'dayjs';

export type LinkyRawPoint = { value: string; date: string; interval_length?: string }; // Result from Linky API
export type HistoryRawPoint = { debut: string; kW: string }; // Result from history CSV file

export type DataPoint = { date: string; value: number }; // Standardized data point. Date is in ISO 8601 format and represents the start of the interval. Value can be W, Wh or EUR.
export type StatisticDataPoint = { start: string; state: number; sum: number }; // Data point formatted for Home Assistant statistics

export function formatDailyData(data: LinkyRawPoint[]): DataPoint[] {
  return data.map((r) => ({
    value: +r.value,
    date: dayjs(r.date).format('YYYY-MM-DDTHH:mm:ssZ'),
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
    value: Number(r.value),
    date: dayjs(r.date)
      .subtract(parseFloat(r.interval_length?.match(/\d+/)[0] || '1'), 'minute')
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

// import_statistics merges by timestamp, so an existing point left out of a re-import keeps its former
// sum and breaks the monotony of the series. Every hour already known must be rewritten, even as a zero.
export function coverExistingHours(data: DataPoint[], existing: DataPoint[]): DataPoint[] {
  const hour = (date: string) => dayjs(date).startOf('hour').valueOf();
  const covered = new Set(data.map((point) => hour(point.date)));

  return [
    ...data,
    ...existing.filter((point) => !covered.has(hour(point.date))).map((point) => ({ ...point, value: 0 })),
  ].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
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

export type StoredStatistic = { start: number; state: number; sum: number };

export function asDataPoints(data: StoredStatistic[]): DataPoint[] {
  return data.map((point) => ({
    date: dayjs(point.start).format('YYYY-MM-DDTHH:mm:ssZ'),
    value: point.state,
  }));
}

// A day is worth re-importing when it is missing, when it holds a single point (a daily total imported
// without hourly detail) or when it holds nothing but zeros (Enedis sometimes serves a load curve full
// of null values). Enedis publishes the load curve within a few days and a day that is still empty
// after that is either lost for good or genuinely empty, so only recent days are retried.
export function findFirstDayToReimport(data: StoredStatistic[], upgradeFrom: dayjs.Dayjs): null | dayjs.Dayjs {
  const perDay = new Map<number, { points: number; total: number }>();
  for (const point of data) {
    const day = dayjs(point.start).startOf('day').valueOf();
    const current = perDay.get(day) ?? { points: 0, total: 0 };
    perDay.set(day, { points: current.points + 1, total: current.total + (point.state ?? 0) });
  }

  const days = [...perDay.keys()].sort((a, b) => a - b);

  for (let i = 0; i < days.length; i++) {
    const day = dayjs(days[i]);
    const expected =
      i === 0
        ? null
        : dayjs(days[i - 1])
            .add(1, 'day')
            .startOf('day');

    if (expected && expected.isBefore(day)) {
      return expected;
    }

    const { points, total } = perDay.get(days[i]);
    if ((points === 1 || total === 0) && !day.isBefore(upgradeFrom.startOf('day'))) {
      return day;
    }
  }

  return null;
}

export function sumBefore(data: { start: number; sum: number }[], day: dayjs.Dayjs): number {
  const previous = data.filter((point) => dayjs(point.start).isBefore(day.startOf('day')));
  return previous.length === 0 ? 0 : previous[previous.length - 1].sum;
}

// A day can be known as a single daily total (Wh) or as an hourly detail. Overwriting a detailed day
// with its total would count it twice, so a day is only replaced by hourly data or when it holds
// nothing usable: no point at all, or only zeros, which is how a load curve full of nulls lands here.
export function mergeByDay(existing: DataPoint[], fetched: DataPoint[]): DataPoint[] {
  const groupByDay = (points: DataPoint[]) =>
    points.reduce(
      (acc, point) => {
        const day = dayjs(point.date).format('YYYY-MM-DD');
        acc[day] = [...(acc[day] ?? []), point];
        return acc;
      },
      {} as { [day: string]: DataPoint[] },
    );

  const existingDays = groupByDay(existing);
  const fetchedDays = groupByDay(fetched);
  const isEmpty = (points?: DataPoint[]) => !points || points.every((point) => !point.value);

  return [...new Set([...Object.keys(existingDays), ...Object.keys(fetchedDays)])].sort().flatMap((day) => {
    if (isEmpty(existingDays[day])) {
      return fetchedDays[day] ?? existingDays[day];
    }
    if (isEmpty(fetchedDays[day])) {
      return existingDays[day];
    }
    return fetchedDays[day].length > 1 ? fetchedDays[day] : existingDays[day];
  });
}
