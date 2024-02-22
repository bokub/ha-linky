import { AveragePowerResponse, EnergyResponse, Session } from 'linky';
import dayjs, { Dayjs } from 'dayjs';
import { debug, info, warn } from './log.js';

export type LinkyDataPoint = { date: string; value: number };
export type EnergyDataPoint = { start: string; state: number; sum: number };

export class LinkyClient {
  private session: Session;
  public prm: string;
  public isProduction: boolean;
  constructor(token: string, prm: string, isProduction: boolean) {
    this.prm = prm;
    this.isProduction = isProduction;
    this.session = new Session(token, prm);
    this.session.userAgent = 'ha-linky/1.3.0';
  }

  public async getEnergyData(firstDay: null | Dayjs): Promise<EnergyDataPoint[]> {
    const history: LinkyDataPoint[][] = [];
    let offset = 0;
    let limitReached = false;
    const keyword = this.isProduction ? 'production' : 'consumption';

    let interval = 7;

    let fromDate = dayjs().subtract(offset + interval, 'days');
    let from = fromDate.format('YYYY-MM-DD');

    if (LinkyClient.isBefore(fromDate, firstDay)) {
      from = firstDay.format('YYYY-MM-DD');
      limitReached = true;
    }

    let to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

    try {
      const loadCurve = this.isProduction
        ? await this.session.getProductionLoadCurve(from, to)
        : await this.session.getLoadCurve(from, to);
      history.unshift(LinkyClient.formatLoadCurve(loadCurve));
      debug(`Successfully retrieved ${keyword} load curve from ${from} to ${to}`);
      offset += interval;
    } catch (e) {
      debug(`Cannot fetch ${keyword} load curve from ${from} to ${to}, here is the error:`);
      warn(e);
    }

    for (let loop = 0; loop < 10; loop++) {
      if (limitReached) {
        break;
      }
      interval = 150;
      fromDate = dayjs().subtract(offset + interval, 'days');
      from = fromDate.format('YYYY-MM-DD');
      to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

      if (LinkyClient.isBefore(fromDate, firstDay)) {
        from = firstDay.format('YYYY-MM-DD');
        limitReached = true;
      }

      try {
        const dailyData = this.isProduction
          ? await this.session.getDailyProduction(from, to)
          : await this.session.getDailyConsumption(from, to);
        history.unshift(LinkyClient.formatDailyData(dailyData));
        debug(`Successfully retrieved daily ${keyword} data from ${from} to ${to}`);
        offset += interval;
      } catch (e) {
        if (
          !firstDay &&
          [
            "The requested period cannot be anterior to the meter's last activation date",
            'The start date must be greater than the history deadline.',
            'no measure found for this usage point',
          ].includes(e.response?.error?.['error_description'])
        ) {
          // Not really an error, just a limit reached
          info(`All available ${keyword} data has been imported`);
          break;
        }
        debug(`Cannot fetch daily ${keyword} data from ${from} to ${to}, here is the error:`);
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
    const grouped = formatted.reduce(
      (acc, cur) => {
        const date = cur.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(cur.value);
        return acc;
      },
      {} as { [date: string]: number[] },
    );
    return Object.entries(grouped).map(([date, values]) => ({
      date,
      value: values.reduce((acc, cur) => acc + cur, 0) / values.length,
    }));
  }

  static isBefore(a: Dayjs, b: Dayjs): boolean {
    return b && (a.isBefore(b, 'day') || a.isSame(b, 'day'));
  }
}
