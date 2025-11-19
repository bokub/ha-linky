import ws, { Message } from 'websocket';
import { MSG_TYPE_AUTH_INVALID, MSG_TYPE_AUTH_OK, MSG_TYPE_AUTH_REQUIRED } from 'home-assistant-js-websocket';
import { auth } from 'home-assistant-js-websocket/dist/messages.js';
import { debug, warn } from './log.js';
import dayjs from 'dayjs';
import { StatisticDataPoint } from './format.js';

const WS_URL = process.env.WS_URL || 'ws://supervisor/core/websocket';
const TOKEN = process.env.SUPERVISOR_TOKEN;

export type SuccessMessage = {
  id: string;
  type: string;
  success: true;
  result: any;
};

export type ErrorMessage = {
  id: string;
  type: string;
  success: false;
  error: any;
};

export type ResultMessage = SuccessMessage | ErrorMessage;

function getStatisticId(args: { prm: string; isProduction: boolean; isCost?: boolean }): string {
  const { prm, isProduction, isCost } = args;
  return `${isProduction ? 'linky_prod' : 'linky'}:${prm}${isCost ? '_cost' : ''}`;
}

export class HomeAssistantClient {
  private messageId = Number(Date.now().toString().slice(9));
  private connection: ws.connection;

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client: ws.client = new ws.client();

      client.addListener('connectFailed', function (error) {
        reject('Connection with Home Assistant failed : ' + error.toString());
      });
      client.addListener('connect', (connection: ws.connection) => {
        connection.on('error', (error) => {
          reject('Connection with Home Assistant returned an error : ' + error.toString());
        });

        connection.on('close', () => {
          debug('Connection with Home Assistant closed');
        });

        connection.once('message', (message: Message) => {
          if (message.type === 'utf8' && JSON.parse(message.utf8Data).type === MSG_TYPE_AUTH_REQUIRED) {
            connection.once('message', (message) => {
              if (message.type === 'utf8') {
                const parsed: { type: string } = JSON.parse(message.utf8Data);
                if (parsed.type === MSG_TYPE_AUTH_INVALID) {
                  reject('Cannot authenticate with Home Assistant');
                }
                if (parsed.type === MSG_TYPE_AUTH_OK) {
                  debug('Connection with Home Assistant established');
                  this.connection = connection;
                  resolve();
                }
              }
            });

            connection.sendUTF(JSON.stringify(auth(TOKEN)));
          }
        });
      });
      client.connect(WS_URL);
    });
  }

  public disconnect() {
    this.connection.close();
  }

  private sendMessage(message: { [key: string]: any }): Promise<SuccessMessage> {
    message.id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.connection.once('message', (message: Message) => {
        if (message.type === 'utf8') {
          const response: ResultMessage = JSON.parse(message.utf8Data);
          if (response.success) {
            resolve(response);
          } else {
            reject('Home Assistant returned an error : ' + message.utf8Data);
          }
        }
      });
      this.connection.sendUTF(JSON.stringify(message));
    });
  }

  public async saveStatistics(args: {
    prm: string;
    name: string;
    isProduction: boolean;
    isCost?: boolean;
    stats: StatisticDataPoint[];
  }) {
    const { prm, name, isProduction, isCost, stats } = args;
    const statisticId = getStatisticId({ prm, isProduction, isCost });

    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name: isCost ? `${name} (costs)` : name,
        source: statisticId.split(':')[0],
        statistic_id: statisticId,
        unit_of_measurement: isCost ? '€' : 'Wh',
      },
      stats,
    });
  }

  public async isNewPRM(args: { prm: string; isProduction: boolean; isCost?: boolean }) {
    const statisticId = getStatisticId(args);
    const ids = await this.sendMessage({
      type: 'recorder/list_statistic_ids',
      statistic_type: 'sum',
    });
    return !ids.result.find((statistic: any) => statistic.statistic_id === statisticId);
  }

  public async findLastStatistic(args: { prm: string; isProduction: boolean; isCost?: boolean }): Promise<null | {
    start: number;
    end: number;
    state: number;
    sum: number;
    change: number;
  }> {
    const { prm, isProduction, isCost } = args;
    const isNew = await this.isNewPRM({ prm, isProduction, isCost });
    if (isNew) {
      if (!isCost) {
        warn(`PRM ${prm} not found in Home Assistant statistics`);
      }
      return null;
    }

    const statisticId = getStatisticId({ prm, isProduction, isCost });

    // Loop over the last 52 weeks
    for (let i = 0; i < 52; i++) {
      const data = await this.sendMessage({
        type: 'recorder/statistics_during_period',
        start_time: dayjs()
          .subtract((i + 1) * 7, 'days')
          .format('YYYY-MM-DDT00:00:00.00Z'),
        end_time: dayjs()
          .subtract(i * 7, 'days')
          .format('YYYY-MM-DDT00:00:00.00Z'),
        statistic_ids: [statisticId],
        period: 'day',
      });
      const points = data.result[statisticId];
      if (points && points.length > 0) {
        const lastDay = dayjs(points[points.length - 1].start).format('DD/MM/YYYY');
        debug('Last saved statistic date is ' + lastDay);
        return points[points.length - 1];
      }
    }

    debug(`No statistics found for PRM ${prm} in Home Assistant`);
    return null;
  }

  public async purge(prm: string, isProduction: boolean) {
    const statisticId = getStatisticId({ prm, isProduction, isCost: false });
    const statisticIdWithCost = getStatisticId({ prm, isProduction, isCost: true });

    warn(`Removing all statistics for PRM ${prm}`);
    await this.sendMessage({
      type: 'recorder/clear_statistics',
      statistic_ids: [statisticId, statisticIdWithCost],
    });
  }

  public async getEntityState(entityId: string): Promise<{ state: string; unit: string | null } | null> {
    try {
      const response = await this.sendMessage({
        type: 'get_states',
      });

      const entity = response.result.find((e: any) => e.entity_id === entityId);

      if (!entity) {
        return null;
      }

      const unit = entity.attributes?.unit_of_measurement || null;

      return {
        state: entity.state,
        unit,
      };
    } catch (e) {
      warn(`Failed to fetch state for entity ${entityId}: ${e.toString()}`);
      return null;
    }
  }

  public async getEntityHistory(args: {
    entityId: string;
    startTime: string;
    endTime: string;
  }): Promise<Array<{ timestamp: string; value: number; unit?: string }>> {
    const { entityId, startTime, endTime } = args;

    const response = await this.sendMessage({
      type: 'history/history_during_period',
      start_time: startTime,
      end_time: endTime,
      entity_ids: [entityId],
      minimal_response: true,
      no_attributes: true,
    });

    const history = response.result[entityId];
    if (!history || !Array.isArray(history) || history.length === 0) {
      return [];
    }

    const validEntries = history.filter(
      (entry: any) => entry.s !== null && entry.s !== undefined && entry.s !== 'unavailable' && entry.s !== 'unknown',
    );

    const result = validEntries
      .map((entry: any) => ({
        timestamp: dayjs(entry.lu * 1000).toISOString(),
        value: parseFloat(entry.s),
      }))
      .filter((entry) => !isNaN(entry.value));

    // Get the entity's unit of measurement
    const entityState = await this.getEntityState(entityId);
    const unit = entityState?.unit || null;

    // Add unit to all results
    const resultWithUnit = result.map((entry) => ({ ...entry, unit }));

    return resultWithUnit;
  }
}
