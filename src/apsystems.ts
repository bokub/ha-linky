import { ApsOpenApi } from './apsystems-openapi.js';
import dayjs, { Dayjs, OpUnitType } from 'dayjs';
import { debug, info, warn, error } from './log.js';
import {
  formatDailyData,
  formatHourlyData,
  formatAsStatistics,
  type StatisticDataPoint,
  type ApsDataPoint,
} from './format.js';

// Get hourly statistics for max 7 days ago
const HOURLY_DATE_INTERVAL = 7
// Get daily statistics for max 2 months ago
const DAILY_DATE_INTERVAL = 2

type Interval = "month" | "day";

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


  public async getEnergyData(firstDay: null | Dayjs): Promise<StatisticDataPoint[]> {
    let history: ApsDataPoint[] = [];
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


    // Get hourly Statistics
    for (offset = 0, limitReached = false; offset < HOURLY_DATE_INTERVAL; offset++) {
      [fromDay, limitReached] = this.calculateFromDate('day', firstDay, offset);
      const fromDayStr = fromDay.format('YYYY-MM-DD');

      for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
        try {
          const loadDatas = await this.openapi.getEcuHourlyConsumption(
            this.systemId,
            this.ecuIds[idx],
            fromDayStr
          );
          //TODO: format hourly datas
          //history.unshift(formatHourlyDatas(loadDatas.energy));
        } catch(e) {
          error(`Error getting Hourly statistics for system ${this.systemId}, `+
                `ecu ${this.ecuIds[idx]} on ${fromDayStr}`);
          error(e.toString());
          limitReached = true;
          break;
        }
      }

      if (limitReached) {
        break;
      }
    }


    if (offset === HOURLY_DATE_INTERVAL) {
      // Get daily Statistics
      for (offset = 0, limitReached = false; offset < DAILY_DATE_INTERVAL; offset++) {
        [fromMonth, limitReached] = this.calculateFromDate('month', firstDay,
                                                           HOURLY_DATE_INTERVAL,
                                                           offset);
        const fromMonthStr = fromMonth.format('YYYY-MM');

        for (let idx: number = 0; idx < this.ecuIds.length; idx++) {
          try {
            const loadDatas = await this.openapi.getEcuDailyConsumption(
              this.systemId,
              this.ecuIds[idx],
              fromMonthStr
            );
          //TODO: formatDaily datas
          //history.unshift(formatDailyDatas(loadDatas.energy));
          } catch(e) {
            error(`Error getting Daily statistics for system ${this.systemId}, `+
                  `ecu ${this.ecuIds[idx]} on ${fromMonthStr}`);
            error(e.toString());
            limitReached = true;
            break;
          }
        }

        if (limitReached) {
          break;
        }
      }
    }

    //TODO: Format all Statistics
    //return formatAsStatistics(history);
    return null;
  }
}
