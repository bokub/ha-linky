import { describe, expect, it } from 'vitest';
import { formatLoadCurve } from './format.js';

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
