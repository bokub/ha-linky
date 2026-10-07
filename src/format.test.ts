import { describe, expect, it } from 'vitest';
import { formatLoadCurve } from './format.js';

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
