import { ApsOpenApi } from './apsystems-openapi.js';
import dayjs, { Dayjs, OpUnitType } from 'dayjs';
import { debug, info, warn, error } from './log.js';
import {
  formatDailyData,
  formatHourlyData,
  formatAsStatistics,
  type StatisticDataPoint,
  type EcuDataPoint,
} from './format.js';

// Get hourly statistics for max 7 days ago
const HOURLY_DATE_INTERVAL = 7
// Get daily statistics for max 2 months ago
const DAILY_DATE_INTERVAL = 2

type Interval = "month" | "day";

export type EcuStatistics = { ecuId: string; data: StatisticDataPoint[] };

export class ApsystemsClient {
  public systemId: string;
  public ecuIds: string[];
  private openapi: ApsOpenApi;

  constructor(systemId: string, ecuIds: string[], appId: string, appSecret: string) {
    this.systemId = systemId;
    this.ecuIds = ecuIds;
    this.openapi = new ApsOpenApi(appId, appSecret);
  }

  private calculateFromDate(
    type: Interval,
    firstDay:Dayjs,
    dayOffset:number,
    monthOffset: number = 0
  ): [Dayjs, boolean] {
    let fromDate: Dayjs = dayjs().subtract(dayOffset, 'days');
    fromDate = fromDate.subtract(monthOffset, 'months');
    let limitReached: boolean = false;

    if (fromDate.isBefore(firstDay, type as OpUnitType) || fromDate.isSame(firstDay, type as OpUnitType)) {
      fromDate = firstDay;
      limitReached = true;
    }
    return [fromDate, limitReached];
  }


  public async getEnergyData(firstDay: null | Dayjs): Promise<EcuStatistics[]> {
    const result: EcuStatistics[] = [];
    let history: EcuDataPoint[][] = [];
    let fromDay: Dayjs = null;
    let fromMonth: Dayjs = null;
    let offset: number = 0;
    let limitReached: boolean = false;

    if (firstDay === null) {
      firstDay = dayjs();
    }

    if (firstDay.isAfter(dayjs(), 'day')) {
      warn(`Getting statistics in the future is impossible `+
           `(date=${firstDay.format('YYYY-MM-DD')})`);
      return null;
    }

    // initialise history for each ecu
    for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
      history[idx] = [];
    }

    // Get hourly Statistics
    for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
      for (offset = 0, limitReached = false; offset < HOURLY_DATE_INTERVAL; offset++) {
        [fromDay, limitReached] = this.calculateFromDate('day', firstDay, offset);
        const fromDayStr = fromDay.format('YYYY-MM-DD');

        try {
          const loadDatas = await this.openapi.getEcuHourlyConsumption(
            this.systemId,
            this.ecuIds[idx],
            fromDayStr
          );
          history[idx].unshift(...formatHourlyData(fromDayStr, loadDatas));
        } catch(e) {
          error(`Error getting Hourly statistics for system ${this.systemId}, `+
                `ecu ${this.ecuIds[idx]} on ${fromDayStr}`);
          error(e.toString());
          limitReached = true;
          break;
        }
        if (limitReached) {
          break;
        }
      }
    }

    // Get Daily Statistics
    if (limitReached === false) {
      for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
        for (offset = 0, limitReached = false; offset < DAILY_DATE_INTERVAL; offset++) {
          [fromMonth, limitReached] = this.calculateFromDate(
            'month', firstDay, HOURLY_DATE_INTERVAL, offset);
          const fromMonthStr = fromMonth.format('YYYY-MM');

          try {
            const loadDatas = await this.openapi.getEcuDailyConsumption(
              this.systemId,
              this.ecuIds[idx],
              fromMonthStr
            );
            let formatedDatas = formatDailyData(fromMonthStr, loadDatas);
            formatedDatas = formatedDatas.filter(d => {
              const current = dayjs(d.date);
              return current.isBefore(fromDay) &&
                (current.isSame(firstDay) || current.isAfter(firstDay));
            });
            history[idx].unshift(...formatedDatas);
          } catch(e) {
            error(`Error getting Daily statistics for system ${this.systemId}, `+
                  `ecu ${this.ecuIds[idx]} on ${fromMonthStr}`);
            error(e.toString());
            limitReached = true;
            break;
          }
          if (limitReached) {
            break;
          }
        }
      }
    }

    // Format all Statistics
    for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
      const ecuStats = {
        ecuId: this.ecuIds[idx],
        data: formatAsStatistics(history[idx])
      };
      result.push(ecuStats);
    }
    return result;
  }
}
