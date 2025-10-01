import { expect, it, vi, describe, beforeEach } from 'vitest';
import { ApsystemsClient } from './apsystems.js';
import dayjs from 'dayjs';

vi.setSystemTime(new Date(2025, 8, 3)); //Mock system date to be 2025/09/03

const getEcuHourlyConsumption = vi.fn();
const getEcuDailyConsumption = vi.fn();

vi.mock('./apsystems-openapi.js', () => ({
  ApsOpenApi: vi.fn(() => ({ getEcuHourlyConsumption, getEcuDailyConsumption })),
}));

let client: ApsystemsClient;

describe('ApsystemsClient', () => {
  beforeEach(() => {
    client = new ApsystemsClient('ab', 'cd');
    getEcuHourlyConsumption.mockReset();
    getEcuDailyConsumption.mockReset();
  });

  it('Fetches yesterday historical data first parameter is null', async () => {
    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8,
      0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
    ]);

    const result = await client.getEnergyData('98', '34', dayjs('2025-09-02'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(1);
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-09-02');

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(0);

    expect(result).toEqual([
      { start: '2025-09-02T00:00:00+02:00', state: 0, sum: 0 },
      { start: '2025-09-02T01:00:00+02:00', state: 100, sum: 100 },
      { start: '2025-09-02T02:00:00+02:00', state: 200, sum: 300 },
      { start: '2025-09-02T03:00:00+02:00', state: 300, sum: 600 },
      { start: '2025-09-02T04:00:00+02:00', state: 400, sum: 1000 },
      { start: '2025-09-02T05:00:00+02:00', state: 500, sum: 1500 },
      { start: '2025-09-02T06:00:00+02:00', state: 600, sum: 2100 },
      { start: '2025-09-02T07:00:00+02:00', state: 700, sum: 2800 },
      { start: '2025-09-02T08:00:00+02:00', state: 800, sum: 3600 },
      { start: '2025-09-02T09:00:00+02:00', state: 900, sum: 4500 },
      { start: '2025-09-02T10:00:00+02:00', state: 1000, sum: 5500 },
      { start: '2025-09-02T11:00:00+02:00', state: 1100, sum: 6600 },
      { start: '2025-09-02T12:00:00+02:00', state: 1200, sum: 7800 },
      { start: '2025-09-02T13:00:00+02:00', state: 1100, sum: 8900 },
      { start: '2025-09-02T14:00:00+02:00', state: 1000, sum: 9900 },
      { start: '2025-09-02T15:00:00+02:00', state: 900, sum: 10800 },
      { start: '2025-09-02T16:00:00+02:00', state: 800, sum: 11600 },
      { start: '2025-09-02T17:00:00+02:00', state: 700, sum: 12300 },
      { start: '2025-09-02T18:00:00+02:00', state: 600, sum: 12900 },
      { start: '2025-09-02T19:00:00+02:00', state: 500, sum: 13400 },
      { start: '2025-09-02T20:00:00+02:00', state: 400, sum: 13800 },
      { start: '2025-09-02T21:00:00+02:00', state: 300, sum: 14100 },
      { start: '2025-09-02T22:00:00+02:00', state: 200, sum: 14300 },
      { start: '2025-09-02T23:00:00+02:00', state: 100, sum: 14400 },
    ]);
  });

  it('Fetches 4 days of historical data', async () => {
    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8,
      0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
    ]);

    const result = await client.getEnergyData('98', '34', dayjs('2025-08-30'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(4);
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-09-02');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-09-01');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-08-31');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-08-30');

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(0);

    expect(result[0].start).toEqual('2025-08-30T00:00:00+02:00');
    expect(result[0].state).toEqual(0);
    expect(result[0].sum).toEqual(0);
    expect(result[24].start).toEqual('2025-08-31T00:00:00+02:00');
    expect(result[24].state).toEqual(0);
    expect(result[24].sum).toEqual(14400);
    expect(result[result.length - 1].start).toEqual('2025-09-02T23:00:00+02:00');
    expect(result[result.length - 1].state).toEqual(100);
    expect(result[result.length - 1].sum).toEqual(57600);
  });

  it('Fetches 1 month of historical data', async () => {
    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8,
      0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
    ]);

    getEcuDailyConsumption.mockReturnValue([
      1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.1, 1.11, 1.12, 1.13, 1.14,
      1.15, 1.16, 1.17, 1.18, 1.19, 1.2, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28,
      1.29,
    ]);

    const result = await client.getEnergyData('98', '34', dayjs('2025-08-10'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(7);

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(1);
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-08');

    expect(result[0].start).toEqual('2025-08-10T00:00:00+02:00');
    expect(result[0].state).toEqual(1900);
    expect(result[0].sum).toEqual(1900);
    expect(result[1].start).toEqual('2025-08-11T00:00:00+02:00');
    expect(result[1].state).toEqual(1100);
    expect(result[1].sum).toEqual(3000);
    expect(result[17].start).toEqual('2025-08-27T00:00:00+02:00');
    expect(result[17].state).toEqual(0);
    expect(result[17].sum).toEqual(20700);
    expect(result[result.length - 1].start).toEqual('2025-09-02T23:00:00+02:00');
    expect(result[result.length - 1].state).toEqual(100);
    expect(result[result.length - 1].sum).toEqual(121500);
    expect(result.filter((entry) => entry.start.startsWith('2025-08-27'))).toHaveLength(
      24,
    );
  });

  it('Fetches max historical data', async () => {
    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8,
      0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
    ]);

    getEcuDailyConsumption.mockReturnValue([
      1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.1, 1.11, 1.12, 1.13, 1.14,
      1.15, 1.16, 1.17, 1.18, 1.19, 1.2, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28,
      1.29,
    ]);

    const result = await client.getEnergyData('98', '34', dayjs('2025-05-10'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(7);

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(2);
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-08');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-07');

    expect(result[0].start).toEqual('2025-07-01T00:00:00+02:00');
    expect(result[0].state).toEqual(1010);
    expect(result[0].sum).toEqual(1010);
    expect(result[31].start).toEqual('2025-08-01T00:00:00+02:00');
    expect(result[31].state).toEqual(1010);
    expect(result[31].sum).toEqual(39420);
    expect(result[57].start).toEqual('2025-08-27T00:00:00+02:00');
    expect(result[57].state).toEqual(0);
    expect(result[57].sum).toEqual(71720);
    expect(result[result.length - 1].start).toEqual('2025-09-02T23:00:00+02:00');
    expect(result[result.length - 1].state).toEqual(100);
    expect(result[result.length - 1].sum).toEqual(172520);
    expect(result.filter((entry) => entry.start.startsWith('2025-08-27'))).toHaveLength(
      24,
    );
  });

  it('Fetches max historical data if date is null', async () => {
    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8,
      0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
    ]);

    getEcuDailyConsumption.mockReturnValue([
      1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.1, 1.11, 1.12, 1.13, 1.14,
      1.15, 1.16, 1.17, 1.18, 1.19, 1.2, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28,
      1.29,
    ]);

    const result = await client.getEnergyData('98', '34', null);

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(7);

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(2);
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-08');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-07');

    expect(result[0].start).toEqual('2025-07-01T00:00:00+02:00');
    expect(result[0].state).toEqual(1010);
    expect(result[0].sum).toEqual(1010);
    expect(result[31].start).toEqual('2025-08-01T00:00:00+02:00');
    expect(result[31].state).toEqual(1010);
    expect(result[31].sum).toEqual(39420);
    expect(result[57].start).toEqual('2025-08-27T00:00:00+02:00');
    expect(result[57].state).toEqual(0);
    expect(result[57].sum).toEqual(71720);
    expect(result[result.length - 1].start).toEqual('2025-09-02T23:00:00+02:00');
    expect(result[result.length - 1].state).toEqual(100);
    expect(result[result.length - 1].sum).toEqual(172520);
    expect(result.filter((entry) => entry.start.startsWith('2025-08-27'))).toHaveLength(
      24,
    );
  });
});
