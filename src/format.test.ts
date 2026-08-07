import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { coverExistingHours, findFirstDayToReimport, formatLoadCurve, mergeByDay, sumBefore } from './format.js';

describe('Load curve formatter', () => {
  it('Should format the load curve properly', () => {
    const result = formatLoadCurve([
      { date: '2022-07-08T01:00:00+02:00', value: '10', interval_length: 'PT60M' },
      { date: '2022-07-08T02:00:00+02:00', value: '15' },
      { date: '2022-07-08T03:00:00+02:00', value: '20', interval_length: 'PT60M' },
      { date: '2024-01-24T22:20:00+01:00', value: '100', interval_length: 'PT20M' },
      { date: '2024-01-24T22:40:00+01:00', value: '100', interval_length: 'PT20M' },
      { date: '2024-01-24T23:00:00+01:00', value: '200', interval_length: 'PT20M' },
      { date: '2024-01-24T23:30:00+01:00', value: '500', interval_length: 'PT30M' },
      { date: '2024-01-25T00:00:00+01:00', value: '700', interval_length: 'PT30M' },
    ]);

    expect(result).toEqual([
      { date: '2022-07-08T00:00:00+02:00', value: 10 },
      { date: '2022-07-08T01:59:00+02:00', value: 15 },
      { date: '2022-07-08T02:00:00+02:00', value: 20 },
      { date: '2024-01-24T22:00:00+01:00', value: 100 },
      { date: '2024-01-24T22:20:00+01:00', value: 100 },
      { date: '2024-01-24T22:40:00+01:00', value: 200 },
      { date: '2024-01-24T23:00:00+01:00', value: 500 },
      { date: '2024-01-24T23:30:00+01:00', value: 700 },
    ]);
  });
});

describe('Re-import detection', () => {
  const day = (d: string) => dayjs(d).startOf('day');
  const detailed = (d: string) =>
    [...Array(24).keys()].map((h) => ({ start: day(d).add(h, 'hour').valueOf(), state: 10, sum: 0 }));
  const coarse = (d: string) => [{ start: day(d).valueOf(), state: 5000, sum: 0 }];
  const upgradeFrom = day('2024-05-01');

  it('Should return null when every day is contiguous and detailed', () => {
    const data = [...detailed('2024-03-30'), ...detailed('2024-03-31'), ...detailed('2024-04-01')];
    expect(findFirstDayToReimport(data, upgradeFrom)).toBeNull();
  });

  it('Should return the first missing day', () => {
    const data = [...detailed('2024-05-01'), ...detailed('2024-05-02'), ...detailed('2024-05-06')];
    expect(findFirstDayToReimport(data, upgradeFrom).format('YYYY-MM-DD')).toBe('2024-05-03');
  });

  it('Should return a day stored as a single daily total', () => {
    const data = [...detailed('2024-05-02'), ...coarse('2024-05-03'), ...detailed('2024-05-04')];
    expect(findFirstDayToReimport(data, upgradeFrom).format('YYYY-MM-DD')).toBe('2024-05-03');
  });

  it('Should return a day filled with nothing but zeros', () => {
    const zeroed = (d: string) =>
      [...Array(24).keys()].map((h) => ({ start: day(d).add(h, 'hour').valueOf(), state: 0, sum: 42 }));
    const data = [...detailed('2024-05-02'), ...zeroed('2024-05-03'), ...detailed('2024-05-04')];
    expect(findFirstDayToReimport(data, upgradeFrom).format('YYYY-MM-DD')).toBe('2024-05-03');
  });

  it('Should give up on a zeroed day older than the upgrade window', () => {
    const zeroed = (d: string) =>
      [...Array(24).keys()].map((h) => ({ start: day(d).add(h, 'hour').valueOf(), state: 0, sum: 42 }));
    const data = [...detailed('2024-04-28'), ...zeroed('2024-04-29'), ...detailed('2024-04-30')];
    expect(findFirstDayToReimport(data, upgradeFrom)).toBeNull();
  });

  it('Should give up on a coarse day older than the upgrade window', () => {
    const data = [...detailed('2024-04-28'), ...coarse('2024-04-29'), ...detailed('2024-04-30')];
    expect(findFirstDayToReimport(data, upgradeFrom)).toBeNull();
  });

  it('Should still fill a missing day older than the upgrade window', () => {
    const data = [...detailed('2024-04-01'), ...detailed('2024-04-05')];
    expect(findFirstDayToReimport(data, upgradeFrom).format('YYYY-MM-DD')).toBe('2024-04-02');
  });

  it('Should prefer the earliest problem', () => {
    const data = [...detailed('2024-05-01'), ...coarse('2024-05-02'), ...detailed('2024-05-04')];
    expect(findFirstDayToReimport(data, upgradeFrom).format('YYYY-MM-DD')).toBe('2024-05-02');
  });

  it('Should not flag a 23-hour day caused by daylight saving', () => {
    const data = [
      ...detailed('2024-03-30'),
      ...[...Array(23).keys()].map((h) => ({ start: day('2024-03-31').add(h, 'hour').valueOf(), state: 10, sum: 0 })),
    ];
    expect(findFirstDayToReimport(data, day('2024-03-01'))).toBeNull();
  });

  it('Should return the sum of the day before the re-imported day', () => {
    const data = [
      { start: day('2024-05-01').add(23, 'hour').valueOf(), state: 10, sum: 100 },
      { start: day('2024-05-02').add(23, 'hour').valueOf(), state: 10, sum: 200 },
      { start: day('2024-05-06').valueOf(), state: 10, sum: 300 },
    ];
    expect(sumBefore(data, day('2024-05-03'))).toBe(200);
    expect(sumBefore(data, day('2024-05-01'))).toBe(0);
  });
});

describe('Day merger', () => {
  const point = (date: string, value: number) => ({ date: dayjs(date).format('YYYY-MM-DDTHH:mm:ssZ'), value });

  it('Should keep existing hourly data over a fetched daily total', () => {
    const existing = [point('2024-05-06T00:00:00', 100), point('2024-05-06T01:00:00', 200)];
    const fetched = [point('2024-05-06T00:00:00', 7000)];
    expect(mergeByDay(existing, fetched)).toEqual(existing);
  });

  it('Should use the fetched daily total for a day absent from Home Assistant', () => {
    const existing = [point('2024-05-06T00:00:00', 100)];
    const fetched = [point('2024-05-05T00:00:00', 7000), point('2024-05-06T00:00:00', 8000)];
    expect(mergeByDay(existing, fetched)).toEqual([fetched[0], existing[0]]);
  });

  it('Should replace an existing day filled with zeros by the fetched daily total', () => {
    const existing = [point('2024-05-06T00:00:00', 0), point('2024-05-06T01:00:00', 0)];
    const fetched = [point('2024-05-06T00:00:00', 7000)];
    expect(mergeByDay(existing, fetched)).toEqual(fetched);
  });

  it('Should keep the daily total when the fetched hourly data is all zeros', () => {
    const existing = [point('2024-05-06T00:00:00', 7000)];
    const fetched = [point('2024-05-06T00:00:00', 0), point('2024-05-06T00:30:00', 0)];
    expect(mergeByDay(existing, fetched)).toEqual(existing);
  });

  it('Should keep an existing zeroed day when nothing was fetched for it', () => {
    const existing = [point('2024-05-06T00:00:00', 0)];
    expect(mergeByDay(existing, [])).toEqual(existing);
  });

  it('Should prefer fetched hourly data', () => {
    const existing = [point('2024-05-06T00:00:00', 100)];
    const fetched = [point('2024-05-06T00:00:00', 150), point('2024-05-06T01:00:00', 250)];
    expect(mergeByDay(existing, fetched)).toEqual(fetched);
  });
});

describe('Existing hour coverage', () => {
  const point = (date: string, value: number) => ({ date: dayjs(date).format('YYYY-MM-DDTHH:mm:ssZ'), value });

  it('Should zero out the hours left behind by a lower resolution re-import', () => {
    const existing = [
      point('2024-05-06T00:00:00', 0),
      point('2024-05-06T01:00:00', 0),
      point('2024-05-06T02:00:00', 0),
    ];
    const data = [point('2024-05-06T00:00:00', 7000)];

    expect(coverExistingHours(data, existing)).toEqual([
      point('2024-05-06T00:00:00', 7000),
      point('2024-05-06T01:00:00', 0),
      point('2024-05-06T02:00:00', 0),
    ]);
  });

  it('Should leave data untouched when every known hour is already covered', () => {
    const existing = [point('2024-05-06T00:00:00', 10), point('2024-05-06T01:00:00', 20)];
    const data = [point('2024-05-06T00:00:00', 30), point('2024-05-06T01:00:00', 40)];
    expect(coverExistingHours(data, existing)).toEqual(data);
  });

  it('Should not zero an hour already covered by a sub-hour point', () => {
    const existing = [point('2024-05-06T01:00:00', 5)];
    const data = [point('2024-05-06T01:00:00', 10), point('2024-05-06T01:30:00', 20)];
    expect(coverExistingHours(data, existing)).toEqual(data);
  });

  it('Should keep the result chronological', () => {
    const existing = [point('2024-05-05T23:00:00', 1), point('2024-05-06T05:00:00', 1)];
    const data = [point('2024-05-06T00:00:00', 7000)];
    expect(coverExistingHours(data, existing).map((p) => p.date)).toEqual([
      point('2024-05-05T23:00:00', 0).date,
      point('2024-05-06T00:00:00', 0).date,
      point('2024-05-06T05:00:00', 0).date,
    ]);
  });
});
