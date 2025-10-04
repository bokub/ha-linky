import { ApsOpenApi } from './apsystems-openapi.js';
import dayjs, { Dayjs, OpUnitType } from 'dayjs';
import { warn, error } from './log.js';
import {
  formatDailyData,
  formatHourlyData,
  formatAsStatistics,
  type StatisticDataPoint,
  type EcuDataPoint,
} from './format.js';

// Maximum lookback period for hourly statistics (7 days max)
const HOURLY_DATE_INTERVAL = 7;
// Maximum lookback period for daily statistics (2 months max)
const DAILY_DATE_INTERVAL = 2;

type Interval = 'month' | 'day';

// Structure returned by energy statistics query
export type EcuStatistics = { ecuId: string; data: StatisticDataPoint[] };

export class ApsystemsClient {
  private openapi: ApsOpenApi;

  constructor(appId: string, appSecret: string) {
    // Initialize the OpenAPI client with app credentials
    this.openapi = new ApsOpenApi(appId, appSecret);
  }

  /**
   * Calculates the date from which statistics should be fetched,
   * based on the offset and the type of interval (day or month).
   *
   * @param type        - Interval type ('day' or 'month')
   * @param firstDay    - The earliest allowed date
   * @param dayOffset   - Number of days to go back
   * @param monthOffset - Number of months to go back
   * @returns A tuple: [calculated date, limitReached (boolean)]
   */
  private calculateFromDate(
    type: Interval,
    firstDay: Dayjs,
    dayOffset: number,
    monthOffset: number = 0,
  ): [Dayjs, boolean] {
    let fromDate: Dayjs = dayjs().subtract(dayOffset + 1, 'days');
    fromDate = fromDate.subtract(monthOffset, 'months');
    let limitReached: boolean = false;

    // If we reached or passed the lower limit (firstDay)
    if (
      fromDate.isBefore(firstDay, type as OpUnitType) ||
      fromDate.isSame(firstDay, type as OpUnitType)
    ) {
      fromDate = firstDay;
      limitReached = true;
    }
    return [fromDate, limitReached];
  }

  /**
   * Retrieves and aggregates ECU energy data (hourly + daily)
   * starting from the provided firstDay until the allowed history depth.
   *
   * @param systemId - The APS system identifier
   * @param ecuId    - The ECU identifier
   * @param firstDay - The earliest date to retrieve data (default: 3 months ago)
   * @returns Aggregated statistics ready for Home Assistant
   */
  public async getEnergyData(
    systemId: string,
    ecuId: string,
    firstDay?: Dayjs | null,
  ): Promise<StatisticDataPoint[]> {
    const history: EcuDataPoint[] = [];
    let fromDay: Dayjs = null;
    let fromMonth: Dayjs = null;
    let offset: number = 0;
    let limitReached: boolean = false;

    // Default: fetch up to 3 months of history
    if (!firstDay) {
      firstDay = dayjs().subtract(3, 'months');
    }

    // Prevent querying today's or future data
    if (firstDay.isAfter(dayjs(), 'day') || firstDay.isSame(dayjs(), 'day')) {
      warn(
        `Getting today's statistics or in the future is impossible ` +
          `(date=${firstDay.format('YYYY-MM-DD')})`,
      );
      return null;
    }

    // ---- Fetch Hourly Statistics (up to HOURLY_DATE_INTERVAL days) ----
    for (offset = 0, limitReached = false; offset < HOURLY_DATE_INTERVAL; offset++) {
      [fromDay, limitReached] = this.calculateFromDate('day', firstDay, offset);
      const fromDayStr = fromDay.format('YYYY-MM-DD');

      try {
        // Call API for hourly energy data
        const loadDatas = await this.openapi.getEcuHourlyConsumption(
          systemId,
          ecuId,
          fromDayStr,
        );
        // Insert results at the beginning of history
        history.unshift(...formatHourlyData(fromDayStr, loadDatas));
      } catch (e) {
        error(
          `Error getting Hourly statistics for system ${systemId}, ` +
            `ecu ${ecuId} on ${fromDayStr}`,
        );
        error(e.toString());
        limitReached = true;
        break;
      }
      if (limitReached) {
        break;
      }
    }

    // ---- Fetch Daily Statistics (up to DAILY_DATE_INTERVAL months) ----
    if (limitReached === false) {
      for (offset = 0, limitReached = false; offset < DAILY_DATE_INTERVAL; offset++) {
        [fromMonth, limitReached] = this.calculateFromDate(
          'month',
          firstDay,
          HOURLY_DATE_INTERVAL, // shift to skip the days already fetched
          offset,
        );
        const fromMonthStr = fromMonth.format('YYYY-MM');

        try {
          // Call API for daily energy data
          const loadDatas = await this.openapi.getEcuDailyConsumption(
            systemId,
            ecuId,
            fromMonthStr,
          );

          // Format and filter daily data to avoid overlaps with hourly data
          let formatedDatas = formatDailyData(fromMonthStr, loadDatas);
          formatedDatas = formatedDatas.filter((d) => {
            const current = dayjs(d.date);
            return (
              current.isBefore(fromDay) &&
              (current.isSame(firstDay) || current.isAfter(firstDay))
            );
          });
          history.unshift(...formatedDatas);
        } catch (e) {
          error(
            `Error getting Daily statistics for system ${systemId}, ` +
              `ecu ${ecuId} on ${fromMonthStr}`,
          );
          error(e.toString());
          limitReached = true;
          break;
        }
        if (limitReached) {
          break;
        }
      }
    }

    // ---- Return formatted statistics for Home Assistant ----
    return formatAsStatistics(history);
  }
}
