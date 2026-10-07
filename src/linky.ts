import { Session } from 'linky';
import dayjs, { Dayjs } from 'dayjs';
import { debug, info, warn } from './log.js';
import { extractLinkyPoints, formatDailyData, formatLoadCurve, type DataPoint } from './format.js';

export class LinkyClient {
  private session: Session;
  public prm: string;
  public isProduction: boolean;
  constructor(token: string, prm: string, isProduction: boolean) {
    this.prm = prm;
    this.isProduction = isProduction;
    this.session = new Session(token, prm);
    this.session.userAgent = 'ha-linky/1.9.0';
  }

  public async getEnergyData(firstDay: null | Dayjs): Promise<DataPoint[]> {
    const history: DataPoint[][] = [];
    let offset = 0;
    let limitReached = false;
    const keyword = this.isProduction ? 'production' : 'consumption';

    let interval = 7;

    let fromDate = dayjs().subtract(offset + interval, 'days');
    let from = fromDate.format('YYYY-MM-DD');

    if (isBefore(fromDate, firstDay)) {
      from = firstDay.format('YYYY-MM-DD');
      limitReached = true;
    }

    let to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

    try {
      const loadCurve = this.isProduction
        ? await this.session.getProductionLoadCurve(from, to)
        : await this.session.getLoadCurve(from, to);

      history.unshift(formatLoadCurve(extractLinkyPoints(loadCurve)));
      debug(`Successfully retrieved ${keyword} load curve from ${from} to ${to}`);
      offset += interval;
    } catch (e) {
      debug(`Cannot fetch ${keyword} load curve from ${from} to ${to}, here is the error:`);
      warn(e);
    }

    const maxLoops = 2;
    for (let loop = 0; loop < 2; loop++) {
      if (limitReached) {
        break;
      }
      interval = (365 - 7) / maxLoops;
      fromDate = dayjs().subtract(offset + interval, 'days');
      from = fromDate.format('YYYY-MM-DD');
      to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

      if (isBefore(fromDate, firstDay)) {
        from = firstDay.format('YYYY-MM-DD');
        limitReached = true;
      }

      try {
        const dailyData = this.isProduction
          ? await this.session.getDailyProduction(from, to)
          : await this.session.getDailyConsumption(from, to);
        history.unshift(formatDailyData(extractLinkyPoints(dailyData)));
        debug(`Successfully retrieved daily ${keyword} data from ${from} to ${to}`);
        offset += interval;
      } catch (e: any) {
        const errorDescription = getErrorDescription(e);
        if (
          !firstDay &&
          [
            "The requested period cannot be anterior to the meter's last activation date",
            'The start date must be greater than the history deadline.',
            'no measure found for this usage point',
          ].includes(errorDescription)
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

    const dataPoints: DataPoint[] = history.flat();

    if (dataPoints.length === 0) {
      warn('Data import returned nothing !');
    } else {
      const intervalFrom = dayjs(dataPoints[0].date).format('DD/MM/YYYY');
      const intervalTo = dayjs(dataPoints[dataPoints.length - 1].date).format('DD/MM/YYYY');
      info(`Data import returned ${dataPoints.length} data points from ${intervalFrom} to ${intervalTo}`);
    }

    return dataPoints;
  }
}

function isBefore(a: Dayjs, b: Dayjs): boolean {
  return b && (a.isBefore(b, 'day') || a.isSame(b, 'day'));
}

function getErrorDescription(error: any): string {
  const payload = error?.response?.data ?? error?.response?.error ?? error?.response ?? error;

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return (
      payload.error_description ??
      payload.error?.error_description ??
      payload.message ??
      payload.detail ??
      payload.error ??
      ''
    );
  }

  return '';
}
