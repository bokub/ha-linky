import { expect, it, vi, describe, beforeEach } from 'vitest';
import { LinkyClient } from './linky.js';
import dayjs from 'dayjs';
import { version } from '../package.json';

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

    expect(getDailyConsumption).toHaveBeenCalledTimes(2);
    expect(getDailyConsumption).toHaveBeenNthCalledWith(1, '2023-06-29', '2023-12-25');
    expect(getDailyConsumption).toHaveBeenNthCalledWith(2, '2023-01-01', '2023-06-29');

    expect(result).toEqual([
      { start: '2023-01-01T00:00:00+01:00', state: 2000, sum: 2000 },
      { start: '2023-06-29T00:00:00+02:00', state: 2000, sum: 4000 },
      { start: '2023-12-31T00:00:00+01:00', state: 200, sum: 4200 },
      { start: '2023-12-31T01:00:00+01:00', state: 500, sum: 4700 },
    ]);
  });

  it('Fetches hourly and daily data when the last statistic is old', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [{ value: '100', date: '2023-12-25 00:30:00', interval_length: 'PT30M' }],
    });
    getDailyConsumption.mockReturnValue({ interval_reading: [{ value: '2000', date: '2023-07-28' }] });

    const result = await client.getEnergyData(dayjs('2023-07-28'));

    expect(getLoadCurve).toHaveBeenCalledOnce();
    expect(getLoadCurve).toHaveBeenCalledWith('2023-12-25', '2024-01-01');
    expect(getDailyConsumption).toHaveBeenCalledOnce();
    expect(getDailyConsumption).toHaveBeenCalledWith('2023-07-28', '2023-12-25');

    expect(result).toEqual([
      { start: '2023-07-28T00:00:00+02:00', state: 2000, sum: 2000 },
      { start: '2023-12-25T00:00:00+01:00', state: 100, sum: 2100 },
    ]);
  });

  it('Fetches only missing hourly data when the last statistic is recent', async () => {
    getLoadCurve.mockReturnValue({
      interval_reading: [{ value: '100', date: '2023-12-25 00:30:00', interval_length: 'PT30M' }],
    });

    const result = await client.getEnergyData(dayjs('2023-12-25'));

    expect(getLoadCurve).toHaveBeenCalledOnce();
    expect(getLoadCurve).toHaveBeenCalledWith('2023-12-25', '2024-01-01');

    expect(getDailyConsumption).not.toHaveBeenCalled();

    expect(result).toEqual([{ start: '2023-12-25T00:00:00+01:00', state: 100, sum: 100 }]);
  });
});
