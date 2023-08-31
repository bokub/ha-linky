import ws, { Message } from 'websocket';
import { MSG_TYPE_AUTH_INVALID, MSG_TYPE_AUTH_OK, MSG_TYPE_AUTH_REQUIRED } from 'home-assistant-js-websocket';
import { auth } from 'home-assistant-js-websocket/dist/messages.js';
import { debug, warn } from './log.js';
import dayjs from 'dayjs';

const WS_URL = 'ws://supervisor/core/websocket';
const SOURCE = 'linky';

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

            connection.sendUTF(JSON.stringify(auth(process.env.SUPERVISOR_TOKEN)));
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

  public async saveStatistics(prm: string, name: string, stats: { start: string; state: number; sum: number }[]) {
    const statisticId = `${SOURCE}:${prm}`;
    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name,
        source: SOURCE,
        statistic_id: statisticId,
        unit_of_measurement: 'Wh',
      },
      stats,
    });
  }

  public async isNewPRM(prm: string) {
    const statisticId = `${SOURCE}:${prm}`;
    const ids = await this.sendMessage({
      type: 'recorder/list_statistic_ids',
      statistic_type: 'sum',
    });
    return !ids.result.find((statistic: any) => statistic.statistic_id === statisticId);
  }

  public async findLastStatistic(prm: string): Promise<null | {
    start: number;
    end: number;
    state: number;
    sum: number;
    change: number;
  }> {
    const isNew = await this.isNewPRM(prm);
    if (isNew) {
      warn(`PRM ${prm} not found in Home Assistant statistics`);
      return null;
    }

    const statisticId = `${SOURCE}:${prm}`;

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

  public async purge(prm: string) {
    const statisticId = `${SOURCE}:${prm}`;

    warn(`Removing all statistics for PRM ${prm}`);
    await this.sendMessage({
      type: 'recorder/clear_statistics',
      statistic_ids: [statisticId],
    });
  }
}
