import { describe, expect, it } from 'vitest';
import { computeCosts } from './cost.js';
import { formatAsStatistics, groupDataPointsByHour } from './format';

describe('Cost computer', () => {
  it('Should take start and end dates in account', () => {
    const result = computeCosts(
      [
        { date: '2024-01-15T00:00:00+01:00', value: 1000 },
        { date: '2024-01-16T00:00:00+01:00', value: 2000 },
        { date: '2024-01-17T00:00:00+01:00', value: 3000 },
        { date: '2024-01-18T00:00:00+01:00', value: 4000 },
        { date: '2024-01-19T00:00:00+01:00', value: 5000 },
        { date: '2024-01-20T00:00:00+01:00', value: 6000 },
      ],
      [
        { price: 0.1, end_date: '2024-01-16' },
        { price: 1, start_date: '2024-01-17', end_date: '2024-01-19' },
        { price: 10, start_date: '2024-01-19' },
      ],
    );

    expect(result).toEqual([
      { date: '2024-01-15T00:00:00+01:00', value: 0.1 },
      { date: '2024-01-17T00:00:00+01:00', value: 3 },
      { date: '2024-01-18T00:00:00+01:00', value: 4 },
      { date: '2024-01-19T00:00:00+01:00', value: 50 },
      { date: '2024-01-20T00:00:00+01:00', value: 60 },
    ]);

    expect(formatAsStatistics(groupDataPointsByHour(result))).toEqual([
      { start: '2024-01-15T00:00:00+01:00', state: 0.1, sum: 0.1 },
      { start: '2024-01-17T00:00:00+01:00', state: 3, sum: 3 + 0.1 },
      { start: '2024-01-18T00:00:00+01:00', state: 4, sum: 4 + 3 + 0.1 },
      { start: '2024-01-19T00:00:00+01:00', state: 50, sum: 50 + 4 + 3 + 0.1 },
      { start: '2024-01-20T00:00:00+01:00', state: 60, sum: 60 + 50 + 4 + 3 + 0.1 },
    ]);
  });

  it('Should take weekday in account', () => {
    const result = computeCosts(
      [
        { date: '2024-01-01T00:00:00+01:00', value: 1000 },
        { date: '2024-01-02T00:00:00+01:00', value: 2000 },
        { date: '2024-01-03T00:00:00+01:00', value: 3000 },
        { date: '2024-01-04T00:00:00+01:00', value: 4000 },
        { date: '2024-01-05T00:00:00+01:00', value: 5000 },
      ],
      [
        { price: 2, weekday: ['mon', 'sun'] },
        { price: 10, weekday: ['wed', 'thu'] },
      ],
    );

    expect(result).toEqual([
      { date: '2024-01-01T00:00:00+01:00', value: 2 },
      { date: '2024-01-03T00:00:00+01:00', value: 30 },
      { date: '2024-01-04T00:00:00+01:00', value: 40 },
    ]);

    expect(formatAsStatistics(groupDataPointsByHour(result))).toEqual([
      { start: '2024-01-01T00:00:00+01:00', state: 2, sum: 2 },
      { start: '2024-01-03T00:00:00+01:00', state: 30, sum: 30 + 2 },
      { start: '2024-01-04T00:00:00+01:00', state: 40, sum: 40 + 30 + 2 },
    ]);
  });

  it('Should take hours in account', () => {
    const result = computeCosts(
      [
        { date: '2024-01-01T00:00:00+01:00', value: 500 },
        { date: '2024-01-01T01:00:00+01:00', value: 1000 },
        { date: '2024-01-01T02:00:00+01:00', value: 2000 },
        { date: '2024-01-01T03:00:00+01:00', value: 3000 },
        { date: '2024-01-01T04:00:00+01:00', value: 4000 },
        { date: '2024-01-01T05:00:00+01:00', value: 5000 },
      ],
      [
        { price: 0.1, before: '01:00' },
        { price: 1, after: '01:00', before: '03:00' },
        { price: 10, after: '03:00', before: '04:00' },
        { price: 100, after: '05:00' },
      ],
    );

    expect(result).toEqual([
      { date: '2024-01-01T00:00:00+01:00', value: 0.05 },
      { date: '2024-01-01T01:00:00+01:00', value: 1 },
      { date: '2024-01-01T02:00:00+01:00', value: 2 },
      { date: '2024-01-01T03:00:00+01:00', value: 30 },
      { date: '2024-01-01T05:00:00+01:00', value: 500 },
    ]);

    expect(formatAsStatistics(groupDataPointsByHour(result))).toEqual([
      { start: '2024-01-01T00:00:00+01:00', state: 0.05, sum: 0.05 },
      { start: '2024-01-01T01:00:00+01:00', state: 1, sum: 1 + 0.05 },
      { start: '2024-01-01T02:00:00+01:00', state: 2, sum: 2 + 1 + 0.05 },
      { start: '2024-01-01T03:00:00+01:00', state: 30, sum: 30 + 2 + 1 + 0.05 },
      { start: '2024-01-01T05:00:00+01:00', state: 500, sum: 500 + 30 + 2 + 1 + 0.05 },
    ]);
  });

  it('Should take minutes in account', () => {
    const result = computeCosts(
      [
        { date: '2024-01-01T01:00:00+01:00', value: 1000 },
        { date: '2024-01-01T01:30:00+01:00', value: 2000 },
        { date: '2024-01-01T02:00:00+01:00', value: 3000 },
        { date: '2024-01-01T02:30:00+01:00', value: 4000 },
        { date: '2024-01-01T03:00:00+01:00', value: 5000 },
        { date: '2024-01-01T03:30:00+01:00', value: 6000 },
      ],
      [
        { price: 0.1, before: '01:30' },
        { price: 0.2, after: '01:30', before: '02:30' },
        { price: 0.3, after: '02:30' },
      ],
    );

    expect(result).toEqual([
      { date: '2024-01-01T01:00:00+01:00', value: Math.round(0.1 * 1000) / 1000 },
      { date: '2024-01-01T01:30:00+01:00', value: Math.round(0.2 * 2000) / 1000 },
      { date: '2024-01-01T02:00:00+01:00', value: Math.round(0.2 * 3000) / 1000 },
      { date: '2024-01-01T02:30:00+01:00', value: Math.round(0.3 * 4000) / 1000 },
      { date: '2024-01-01T03:00:00+01:00', value: Math.round(0.3 * 5000) / 1000 },
      { date: '2024-01-01T03:30:00+01:00', value: Math.round(0.3 * 6000) / 1000 },
    ]);
  });
});
