import { describe, expect, it } from 'vitest';
import { formatAsStatistics, formatLoadCurve, groupDataPointsByHour } from './format.js';

describe('Load curve formatter', () => {
  it('Should format the load curve properly', () => {
    const result = formatLoadCurve([
      { d: '2022-07-08T01:00:00+02:00', v: '10', p: 'PT60M' },
      { d: '2022-07-08T02:00:00+02:00', v: '15' },
      { d: '2022-07-08T03:00:00+02:00', v: '20', p: 'PT60M' },
      { d: '2024-01-24T22:20:00+01:00', v: '100', p: 'PT20M' },
      { d: '2024-01-24T22:40:00+01:00', v: '100', p: 'PT20M' },
      { d: '2024-01-24T23:00:00+01:00', v: '200', p: 'PT20M' },
      { d: '2024-01-24T23:30:00+01:00', v: '500', p: 'PT30M' },
      { d: '2024-01-25T00:00:00+01:00', v: '700', p: 'PT30M' },
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

describe('Hourly data grouping', () => {
  it('Should keep both occurrences of the repeated autumn hour separate', () => {
    const result = groupDataPointsByHour([
      { date: '2026-10-25T02:00:00+02:00', value: 100 },
      { date: '2026-10-25T02:30:00+02:00', value: 300 },
      { date: '2026-10-25T02:00:00+01:00', value: 500 },
      { date: '2026-10-25T02:30:00+01:00', value: 700 },
    ]);

    expect(result).toEqual([
      { date: '2026-10-25T02:00:00+02:00', value: 200 },
      { date: '2026-10-25T02:00:00+01:00', value: 600 },
    ]);
    expect(formatAsStatistics(result)).toEqual([
      { start: '2026-10-25T02:00:00+02:00', state: 200, sum: 200 },
      { start: '2026-10-25T02:00:00+01:00', state: 600, sum: 800 },
    ]);
  });

  it.each([
    ['2026-10-24T00:00:00+02:00', 24],
    ['2026-10-25T00:00:00+02:00', 25],
    ['2026-03-29T00:00:00+01:00', 23],
  ])('Should preserve the energy of the day starting at %s (%i hours)', (start, hours) => {
    const startTime = Date.parse(start);
    const raw = Array.from({ length: hours * 2 }, (_, index) => ({
      d: new Date(startTime + (index + 1) * 30 * 60 * 1000).toISOString(),
      v: '1000',
      p: 'PT30M',
    }));
    const result = formatAsStatistics(groupDataPointsByHour(formatLoadCurve(raw)));

    expect(result).toHaveLength(hours);
    expect(result.map((point) => Date.parse(point.start))).toEqual(
      Array.from({ length: hours }, (_, index) => startTime + index * 60 * 60 * 1000),
    );
    expect(result.every((point) => point.state === 1000)).toBe(true);
    expect(result[result.length - 1].sum).toBe(hours * 1000);
  });

  it('Should preserve rounding and empty input behavior', () => {
    expect(
      groupDataPointsByHour([
        { date: '2026-10-24T12:00:00+02:00', value: 1.234 },
        { date: '2026-10-24T12:30:00+02:00', value: 2.345 },
      ]),
    ).toEqual([{ date: '2026-10-24T12:00:00+02:00', value: 1.79 }]);
    expect(groupDataPointsByHour([])).toEqual([]);
  });
});
