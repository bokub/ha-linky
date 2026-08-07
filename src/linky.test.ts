import { expect, it, vi, describe, beforeEach } from 'vitest';
import { LinkyClient } from './linky.js';
import dayjs from 'dayjs';
import { version } from '../package.json';
import { formatAsStatistics, groupDataPointsByHour } from './format.js';
import * as fs from 'node:fs';

vi.setSystemTime(new Date(2024, 0, 1));

const getLoadCurve = vi.fn();
const getDailyConsumption = vi.fn();

vi.mock('linky', () => ({
  Session: vi.fn(() => ({ getLoadCurve, getDailyConsumption })),
}));

let client: LinkyClient;

describe('LinkyClient', () => {
  beforeEach(() => {
    client = new LinkyClient('', '', false);
    getLoadCurve.mockReset();
    getDailyConsumption.mockReset();
  });

  it('Has the same version in package.json & config.yaml', () => {
    const config = fs.readFileSync('config.yaml', 'utf8');
    const match = config.match(/version:\s*['"]?([\d.]+)['"]?/);
    expect(version).toBe(match[1]);
  });

  it('Has the right user agent', () => {
    expect((client as any).session.userAgent).toBe('ha-linky/' + version);
  });

  it('Fetches 1 year of historical data if first parameter is null', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [
        { value: '100', date: '2023-12-31 00:30:00', interval_length: 'PT30M' },
        { value: '300', date: '2023-12-31 01:00:00', interval_length: 'PT30M' },
        { value: '500', date: '2023-12-31 01:30:00', interval_length: 'PT30M' },
      ],
    });

    getDailyConsumption.mockImplementation((start: string) => ({ interval_reading: [{ value: '2000', date: start }] }));

    const result = await client.getEnergyData(null);

    expect(getLoadCurve).toHaveBeenCalledOnce();
    expect(getLoadCurve).toHaveBeenCalledWith('2023-12-25', '2024-01-01');

    expect(getDailyConsumption).toHaveBeenCalledTimes(3);
    expect(getDailyConsumption).toHaveBeenNthCalledWith(1, '2023-12-25', '2024-01-01');
    expect(getDailyConsumption).toHaveBeenNthCalledWith(2, '2023-06-29', '2023-12-25');
    expect(getDailyConsumption).toHaveBeenNthCalledWith(3, '2023-01-01', '2023-06-29');

    expect(result).toEqual([
      { date: '2023-01-01T00:00:00+01:00', value: 2000 },
      { date: '2023-06-29T00:00:00+02:00', value: 2000 },
      { date: '2023-12-25T00:00:00+01:00', value: 2000 },
      { date: '2023-12-31T00:00:00+01:00', value: 100 },
      { date: '2023-12-31T00:30:00+01:00', value: 300 },
      { date: '2023-12-31T01:00:00+01:00', value: 500 },
    ]);

    expect(formatAsStatistics(groupDataPointsByHour(result))).toEqual([
      { start: '2023-01-01T00:00:00+01:00', state: 2000, sum: 2000 },
      { start: '2023-06-29T00:00:00+02:00', state: 2000, sum: 4000 },
      { start: '2023-12-25T00:00:00+01:00', state: 2000, sum: 6000 },
      { start: '2023-12-31T00:00:00+01:00', state: 200, sum: 6200 },
      { start: '2023-12-31T01:00:00+01:00', state: 500, sum: 6700 },
    ]);
  });

  it('Fetches hourly and daily data when the last statistic is old', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [
        { value: '100', date: '2023-12-25 00:30:00', interval_length: 'PT30M' },
        { value: '300', date: '2023-12-25 01:00:00', interval_length: 'PT30M' },
      ],
    });
    getDailyConsumption.mockImplementation((start: string) => ({ interval_reading: [{ value: '2000', date: start }] }));

    const result = await client.getEnergyData(dayjs('2023-07-28'));

    expect(getLoadCurve).toHaveBeenCalledOnce();
    expect(getLoadCurve).toHaveBeenCalledWith('2023-12-25', '2024-01-01');
    expect(getDailyConsumption).toHaveBeenCalledTimes(2);
    expect(getDailyConsumption).toHaveBeenNthCalledWith(1, '2023-12-25', '2024-01-01');
    expect(getDailyConsumption).toHaveBeenNthCalledWith(2, '2023-07-28', '2023-12-25');

    expect(result).toEqual([
      { date: '2023-07-28T00:00:00+02:00', value: 2000 },
      { date: '2023-12-25T00:00:00+01:00', value: 100 },
      { date: '2023-12-25T00:30:00+01:00', value: 300 },
    ]);
    expect(formatAsStatistics(groupDataPointsByHour(result))).toEqual([
      { start: '2023-07-28T00:00:00+02:00', state: 2000, sum: 2000 },
      { start: '2023-12-25T00:00:00+01:00', state: 200, sum: 2200 },
    ]);
  });

  it('Keeps the load curve over the daily total when the last statistic is recent', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [
        { value: '100', date: '2023-12-25 00:30:00', interval_length: 'PT30M' },
        { value: '300', date: '2023-12-25 01:00:00', interval_length: 'PT30M' },
      ],
    });
    getDailyConsumption.mockReturnValue({ interval_reading: [{ value: '9999', date: '2023-12-25' }] });

    const result = await client.getEnergyData(dayjs('2023-12-25'));

    expect(getLoadCurve).toHaveBeenCalledOnce();
    expect(getLoadCurve).toHaveBeenCalledWith('2023-12-25', '2024-01-01');
    expect(getDailyConsumption).toHaveBeenCalledWith('2023-12-25', '2024-01-01');

    expect(result).toEqual([
      { date: '2023-12-25T00:00:00+01:00', value: 100 },
      { date: '2023-12-25T00:30:00+01:00', value: 300 },
    ]);
  });

  it('Falls back to the daily total for a day absent from the load curve', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [
        { value: '100', date: '2023-12-27 00:30:00', interval_length: 'PT30M' },
        { value: '300', date: '2023-12-27 01:00:00', interval_length: 'PT30M' },
      ],
    });
    getDailyConsumption.mockReturnValue({
      interval_reading: [
        { value: '5000', date: '2023-12-26' },
        { value: '9999', date: '2023-12-27' },
      ],
    });

    const result = await client.getEnergyData(dayjs('2023-12-26'));

    expect(result).toEqual([
      { date: '2023-12-26T00:00:00+01:00', value: 5000 },
      { date: '2023-12-27T00:00:00+01:00', value: 100 },
      { date: '2023-12-27T00:30:00+01:00', value: 300 },
    ]);
  });

  it('Prefers the daily total over a load curve day reduced to a single interval', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [{ value: '100', date: '2023-12-27 00:30:00', interval_length: 'PT30M' }],
    });
    getDailyConsumption.mockReturnValue({ interval_reading: [{ value: '9999', date: '2023-12-27' }] });

    const result = await client.getEnergyData(dayjs('2023-12-27'));

    expect(result).toEqual([{ date: '2023-12-27T00:00:00+01:00', value: 9999 }]);
  });
});
