import { expect, it, vi, describe, beforeEach } from 'vitest';
import { ApsystemsClient } from './apsystems.js';
import dayjs from 'dayjs';

vi.setSystemTime(new Date(2025, 8, 1)); //Mock system date to be 2025/09/01

const getEcuHourlyConsumption = vi.fn();
const getEcuDailyConsumption = vi.fn();

vi.mock('./apsystems-openapi.js', () => ({
  ApsOpenApi: vi.fn(() => ({ getEcuHourlyConsumption, getEcuDailyConsumption })),
}));

let client: ApsystemsClient;

describe('ApsystemsClient', () => {
  beforeEach(() => {
    client = new ApsystemsClient('98', ['12', '34'], 'ab', 'cd');
    getEcuHourlyConsumption.mockReset();
    getEcuDailyConsumption.mockReset();
  });

  it('Fetches today historical data if first parameter is null', async () => {

    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
      1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
    ]);

    const result = await client.getEnergyData(null);

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(2);
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '12', '2025-09-01');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-09-01');

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(0);

    const commonData = [
      { start: '2025-09-01T00:00:00+02:00', state: 0, sum: 0 },
      { start: '2025-09-01T01:00:00+02:00', state: 100, sum: 100 },
      { start: '2025-09-01T02:00:00+02:00', state: 200, sum: 300 },
      { start: '2025-09-01T03:00:00+02:00', state: 300, sum: 600 },
      { start: '2025-09-01T04:00:00+02:00', state: 400, sum: 1000 },
      { start: '2025-09-01T05:00:00+02:00', state: 500, sum: 1500 },
      { start: '2025-09-01T06:00:00+02:00', state: 600, sum: 2100 },
      { start: '2025-09-01T07:00:00+02:00', state: 700, sum: 2800 },
      { start: '2025-09-01T08:00:00+02:00', state: 800, sum: 3600 },
      { start: '2025-09-01T09:00:00+02:00', state: 900, sum: 4500 },
      { start: '2025-09-01T10:00:00+02:00', state: 1000, sum: 5500 },
      { start: '2025-09-01T11:00:00+02:00', state: 1100, sum: 6600 },
      { start: '2025-09-01T12:00:00+02:00', state: 1200, sum: 7800 },
      { start: '2025-09-01T13:00:00+02:00', state: 1100, sum: 8900 },
      { start: '2025-09-01T14:00:00+02:00', state: 1000, sum: 9900 },
      { start: '2025-09-01T15:00:00+02:00', state: 900, sum: 10800 },
      { start: '2025-09-01T16:00:00+02:00', state: 800, sum: 11600 },
      { start: '2025-09-01T17:00:00+02:00', state: 700, sum: 12300 },
      { start: '2025-09-01T18:00:00+02:00', state: 600, sum: 12900 },
      { start: '2025-09-01T19:00:00+02:00', state: 500, sum: 13400 },
      { start: '2025-09-01T20:00:00+02:00', state: 400, sum: 13800 },
      { start: '2025-09-01T21:00:00+02:00', state: 300, sum: 14100 },
      { start: '2025-09-01T22:00:00+02:00', state: 200, sum: 14300 },
      { start: '2025-09-01T23:00:00+02:00', state: 100, sum: 14400 }
    ];

    expect(result).toEqual([
      { ecuId: '12', data: commonData },
      { ecuId: '34', data: commonData }
    ]);
  });

  it('Fetches 3 days of historical data', async () => {

    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
      1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
    ]);

    const result = await client.getEnergyData(dayjs('2025-08-30'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(6);
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '12', '2025-09-01');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-09-01');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '12', '2025-08-31');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-08-31');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '12', '2025-08-30');
    expect(getEcuHourlyConsumption).toHaveBeenCalledWith('98', '34', '2025-08-30');

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(0);

    result.forEach(item => {
      expect(item.data[0].start).toEqual('2025-08-30T00:00:00+02:00');
      expect(item.data[0].state).toEqual(0);
      expect(item.data[0].sum).toEqual(0);
      expect(item.data[24].start).toEqual('2025-08-31T00:00:00+02:00');
      expect(item.data[24].state).toEqual(0);
      expect(item.data[24].sum).toEqual(14400);
      expect(item.data[item.data.length-1].start).toEqual('2025-09-01T23:00:00+02:00');
      expect(item.data[item.data.length-1].state).toEqual(100);
      expect(item.data[item.data.length-1].sum).toEqual(43200);
    });
  });

  it('Fetches 1 month of historical data', async () => {

    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
      1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
    ]);

    getEcuDailyConsumption.mockReturnValue([
      1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13,
      1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21, 1.22, 1.23, 1.24, 1.25,
      1.26, 1.27, 1.28, 1.29
    ]);

    const result = await client.getEnergyData(dayjs('2025-08-10'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(14);

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(2);
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '12', '2025-08');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-08');

    result.forEach(item => {
      expect(item.data[0].start).toEqual('2025-08-10T00:00:00+02:00');
      expect(item.data[0].state).toEqual(1900);
      expect(item.data[0].sum).toEqual(1900);
      expect(item.data[1].start).toEqual('2025-08-11T00:00:00+02:00');
      expect(item.data[1].state).toEqual(1100);
      expect(item.data[1].sum).toEqual(3000);
      expect(item.data[15].start).toEqual('2025-08-25T00:00:00+02:00');
      expect(item.data[15].state).toEqual(1240);
      expect(item.data[15].sum).toEqual(19450);
      expect(item.data[item.data.length-1].start).toEqual('2025-09-01T23:00:00+02:00');
      expect(item.data[item.data.length-1].state).toEqual(100);
      expect(item.data[item.data.length-1].sum).toEqual(120250);
      expect(item.data.filter(entry => entry.start.startsWith('2025-08-26'))).toHaveLength(24);
    });
  });

  it('Fetches max historical data', async () => {

    getEcuHourlyConsumption.mockReturnValue([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
      1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
    ]);

    getEcuDailyConsumption.mockReturnValue([
      1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13,
      1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21, 1.22, 1.23, 1.24, 1.25,
      1.26, 1.27, 1.28, 1.29
    ]);

    const result = await client.getEnergyData(dayjs('2025-05-10'));

    expect(getEcuHourlyConsumption).toHaveBeenCalledTimes(14);

    expect(getEcuDailyConsumption).toHaveBeenCalledTimes(4);
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '12', '2025-08');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-08');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '12', '2025-07');
    expect(getEcuDailyConsumption).toHaveBeenCalledWith('98', '34', '2025-07');

    result.forEach(item => {
      expect(item.data[0].start).toEqual('2025-07-01T00:00:00+02:00');
      expect(item.data[0].state).toEqual(1010);
      expect(item.data[0].sum).toEqual(1010);
      expect(item.data[31].start).toEqual('2025-08-01T00:00:00+02:00');
      expect(item.data[31].state).toEqual(1010);
      expect(item.data[31].sum).toEqual(39420);
      expect(item.data[item.data.length-1].start).toEqual('2025-09-01T23:00:00+02:00');
      expect(item.data[item.data.length-1].state).toEqual(100);
      expect(item.data[item.data.length-1].sum).toEqual(171270);
      expect(item.data.filter(entry => entry.start.startsWith('2025-08-26'))).toHaveLength(24);
    });
  });
});
