import { AveragePowerResponse, EnergyResponse, Session } from 'linky';
import dayjs, { Dayjs } from 'dayjs';
import { debug, info, warn } from './log.js';

export type LinkyDataPoint = { date: string; value: number };
export type EnergyDataPoint = { start: string; state: number; sum: number };

export class LinkyClient {
  private session: Session;
  public prm: string;
  constructor(token: string, prm: string) {
    this.prm = prm;
    this.session = new Session(token, prm);
    this.session.userAgent = 'ha-linky/0.1.0';
  }

  public async getEnergyData(firstDay: null | Dayjs): Promise<EnergyDataPoint[]> {
    let history: LinkyDataPoint[][] = [];
    let offset = 0;
    let limitReached = false;

    let interval = 7;
    let from = dayjs()
      .subtract(offset + interval, 'days')
      .format('YYYY-MM-DD');

    if (
      firstDay &&
      dayjs()
        .subtract(offset + interval, 'days')
        .isBefore(firstDay, 'day')
    ) {
      from = firstDay.format('YYYY-MM-DD');
      limitReached = true;
    }

    let to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');
    try {
      const loadCurve = await this.session.getLoadCurve(from, to);
      history.unshift(LinkyClient.formatLoadCurve(loadCurve));
      debug(`Successfully retrieved load curve from ${from} to ${to}`);
      offset += interval;
    } catch (e) {
      debug(`Cannot fetch load curve from ${from} to ${to}, here is the error:`);
      warn(e);
    }

    for (let loop = 0; loop < 10; loop++) {
      if (limitReached) {
        break;
      }
      interval = 150;
      from = dayjs()
        .subtract(offset + interval, 'days')
        .format('YYYY-MM-DD');
      to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

      if (
        firstDay &&
        dayjs()
          .subtract(offset + interval, 'days')
          .isBefore(firstDay, 'day')
      ) {
        from = firstDay.format('YYYY-MM-DD');
        limitReached = true;
      }

      try {
        const dailyData = await this.session.getDailyConsumption(from, to);
        history.unshift(LinkyClient.formatDailyData(dailyData));
        debug(`Successfully retrieved daily data from ${from} to ${to}`);
        offset += interval;
      } catch (e) {
        debug(`Cannot fetch daily data from ${from} to ${to}, here is the error:`);
        warn(e);
        break;
      }
    }

    const dataPoints: LinkyDataPoint[] = history.flat();

    if (dataPoints.length === 0) {
      warn('Data import returned nothing !');
    } else {
      const intervalFrom = dayjs(dataPoints[0].date).format('DD/MM/YYYY');
      const intervalTo = dayjs(dataPoints[dataPoints.length - 1].date).format('DD/MM/YYYY');
      info(`Data import returned ${dataPoints.length} data points from ${intervalFrom} to ${intervalTo}`);
    }

    const result: EnergyDataPoint[] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      result[i] = {
        start: dataPoints[i].date,
        state: dataPoints[i].value,
        sum: dataPoints[i].value + (i === 0 ? 0 : result[i - 1].sum),
      };
    }

    return result;
  }

  static formatDailyData(data: EnergyResponse): LinkyDataPoint[] {
    return data.interval_reading.map((r) => ({
      value: +r.value,
      date: dayjs(r.date).format('YYYY-MM-DDTHH:mm:ssZ'),
    }));
  }

  static formatLoadCurve(data: AveragePowerResponse): LinkyDataPoint[] {
    const formatted = data.interval_reading.map((r) => ({
      value: +r.value,
      date: dayjs(r.date)
        .subtract((r as any).interval_length.match(/\d+/)[0], 'minute')
        .startOf('hour')
        .format('YYYY-MM-DDTHH:mm:ssZ'),
    }));
    const grouped = formatted.reduce((acc, cur) => {
      const date = cur.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(cur.value);
      return acc;
    }, {} as { [date: string]: number[] });
    return Object.entries(grouped).map(([date, values]) => ({
      date,
      value: values.reduce((acc, cur) => acc + cur, 0) / values.length,
    }));
  }
}
