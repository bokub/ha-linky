import { describe, expect, it } from 'vitest';
import { computeCosts, EntityHistoryData } from './cost.js';
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

  it('Should compute costs using entity history', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.electricity_price': [
        { timestamp: '2024-01-01T00:00:00+01:00', value: 0.1 },
        { timestamp: '2024-01-01T12:00:00+01:00', value: 0.2 },
        { timestamp: '2024-01-02T00:00:00+01:00', value: 0.15 },
      ],
    };

    const result = computeCosts(
      [
        { date: '2024-01-01T06:00:00+01:00', value: 1000 },
        { date: '2024-01-01T14:00:00+01:00', value: 2000 },
        { date: '2024-01-02T06:00:00+01:00', value: 3000 },
      ],
      [{ entity_id: 'sensor.electricity_price' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.1 }, // Uses 0.1 (price at 00:00)
      { date: '2024-01-01T14:00:00+01:00', value: 0.4 }, // Uses 0.2 (price at 12:00)
      { date: '2024-01-02T06:00:00+01:00', value: 0.45 }, // Uses 0.15 (price at 00:00)
    ]);
  });

  it('Should handle multiple entity history sources without time filters', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.peak_price': [
        { timestamp: '2024-01-01T00:00:00+01:00', value: 0.3 },
        { timestamp: '2024-01-01T08:00:00+01:00', value: 0.4 },
        { timestamp: '2024-01-01T20:00:00+01:00', value: 0.3 },
      ],
      'sensor.offpeak_price': [
        { timestamp: '2024-01-01T00:00:00+01:00', value: 0.1 },
        { timestamp: '2024-01-01T06:00:00+01:00', value: 0.12 },
      ],
    };

    const result = computeCosts(
      [
        { date: '2024-01-01T04:00:00+01:00', value: 1000 },
        { date: '2024-01-01T10:00:00+01:00', value: 2000 },
        { date: '2024-01-01T22:00:00+01:00', value: 3000 },
      ],
      [{ entity_id: 'sensor.peak_price' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T04:00:00+01:00', value: 0.3 }, // Uses peak price 0.3
      { date: '2024-01-01T10:00:00+01:00', value: 0.8 }, // Uses peak price 0.4
      { date: '2024-01-01T22:00:00+01:00', value: 0.9 }, // Uses peak price 0.3
    ]);
  });

  it('Should skip data points without matching entity history', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.electricity_price': [{ timestamp: '2024-01-01T12:00:00+01:00', value: 0.2 }],
    };

    const result = computeCosts(
      [
        { date: '2024-01-01T06:00:00+01:00', value: 1000 }, // Before any price data
        { date: '2024-01-01T14:00:00+01:00', value: 2000 }, // After price data
      ],
      [{ entity_id: 'sensor.electricity_price' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T14:00:00+01:00', value: 0.4 }, // Only this one has price
    ]);
  });

  it('Should fallback to static price when entity_id not in history', () => {
    const entityHistory: EntityHistoryData = {};

    const result = computeCosts(
      [
        { date: '2024-01-01T06:00:00+01:00', value: 1000 },
        { date: '2024-01-01T14:00:00+01:00', value: 2000 },
      ],
      [{ price: 0.25 }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.25 },
      { date: '2024-01-01T14:00:00+01:00', value: 0.5 },
    ]);
  });

  it('Should combine static and entity-based pricing', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.electricity_price': [{ timestamp: '2024-01-01T00:00:00+01:00', value: 0.2 }],
    };

    const result = computeCosts(
      [
        { date: '2024-01-01T06:00:00+01:00', value: 1000 },
        { date: '2024-01-01T14:00:00+01:00', value: 2000 },
      ],
      [
        { entity_id: 'sensor.electricity_price', before: '12:00' },
        { price: 0.3, after: '12:00' },
      ],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.2 }, // Entity-based
      { date: '2024-01-01T14:00:00+01:00', value: 0.6 }, // Static price
    ]);
  });

  it('Should convert cents to euros automatically', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.electricity_price_cents': [
        { timestamp: '2024-01-01T00:00:00+01:00', value: 20, unit: 'c€/kWh' }, // 20 cents = 0.20 euros
        { timestamp: '2024-01-01T12:00:00+01:00', value: 25, unit: 'c€/kWh' }, // 25 cents = 0.25 euros
      ],
    };

    const result = computeCosts(
      [
        { date: '2024-01-01T06:00:00+01:00', value: 1000 },
        { date: '2024-01-01T14:00:00+01:00', value: 2000 },
      ],
      [{ entity_id: 'sensor.electricity_price_cents' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.2 }, // 20 cents * 1000 Wh / 100 / 1000 = 0.2 €
      { date: '2024-01-01T14:00:00+01:00', value: 0.5 }, // 25 cents * 2000 Wh / 100 / 1000 = 0.5 €
    ]);
  });

  it('Should handle EUR/MWh unit', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.spot_price': [
        { timestamp: '2024-01-01T00:00:00+01:00', value: 200, unit: 'EUR/MWh' }, // 200 EUR/MWh = 0.2 €/kWh
      ],
    };

    const result = computeCosts(
      [{ date: '2024-01-01T06:00:00+01:00', value: 1000 }],
      [{ entity_id: 'sensor.spot_price' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.2 }, // 200 EUR/MWh * 1000 Wh / 1000 / 1000 = 0.2 €
    ]);
  });

  it('Should handle price without unit (assume €/kWh)', () => {
    const entityHistory: EntityHistoryData = {
      'sensor.price_no_unit': [{ timestamp: '2024-01-01T00:00:00+01:00', value: 0.25 }],
    };

    const result = computeCosts(
      [{ date: '2024-01-01T06:00:00+01:00', value: 1000 }],
      [{ entity_id: 'sensor.price_no_unit' }],
      entityHistory,
    );

    expect(result).toEqual([
      { date: '2024-01-01T06:00:00+01:00', value: 0.25 }, // Assume €/kWh
    ]);
  });
});
