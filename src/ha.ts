import process from 'node:process';
import ws, { Message } from 'websocket';
import {
  MSG_TYPE_AUTH_INVALID,
  MSG_TYPE_AUTH_OK,
  MSG_TYPE_AUTH_REQUIRED,
} from 'home-assistant-js-websocket';
import { auth } from 'home-assistant-js-websocket/dist/messages.js';
import { debug, warn } from './log.js';
import dayjs from 'dayjs';
import { StatisticDataPoint } from './format.js';

// WebSocket URL and token for connecting to Home Assistant Supervisor
const WS_URL = process.env.WS_URL || 'ws://supervisor/core/websocket';
const TOKEN = process.env.SUPERVISOR_TOKEN;

/**
 * Represents a successful response from Home Assistant WebSocket API
 */
export type SuccessMessage = {
  id: string;
  type: string;
  success: true;
  result: any;
};

/**
 * Represents an error response from Home Assistant WebSocket API
 */
export type ErrorMessage = {
  id: string;
  type: string;
  success: false;
  error: any;
};

/**
 * Union type for WebSocket responses
 */
export type ResultMessage = SuccessMessage | ErrorMessage;

/**
 * Generates a unique statistic ID for a given system and ECU
 */
function getStatisticId(systemId: string, ecuId: string): string {
  return `apsystems:${systemId}_${ecuId}`;
}

/**
 * Client to interact with Home Assistant via WebSocket API
 */
export class HomeAssistantClient {
  private messageId = Number(Date.now().toString().slice(9)); // Unique incremental ID for messages
  private connection: ws.connection; // WebSocket connection

  /**
   * Establishes a connection to Home Assistant
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client: ws.client = new ws.client();

      // Handle connection failures
      client.addListener('connectFailed', function (error) {
        reject('Connection with Home Assistant failed : ' + error.toString());
      });

      // Handle successful connection
      client.addListener('connect', (connection: ws.connection) => {
        // Handle runtime errors
        connection.on('error', (error) => {
          reject(
            'Connection with Home Assistant returned an error : ' + error.toString(),
          );
        });

        // Log connection close
        connection.on('close', () => {
          debug('Connection with Home Assistant closed');
        });

        // Listen for the first message (authentication required)
        connection.once('message', (message: Message) => {
          if (
            message.type === 'utf8' &&
            JSON.parse(message.utf8Data).type === MSG_TYPE_AUTH_REQUIRED
          ) {
            // Listen for authentication response
            connection.once('message', (message) => {
              if (message.type === 'utf8') {
                const parsed: { type: string } = JSON.parse(message.utf8Data);
                if (parsed.type === MSG_TYPE_AUTH_INVALID) {
                  reject('Cannot authenticate with Home Assistant');
                }
                if (parsed.type === MSG_TYPE_AUTH_OK) {
                  debug('Connection with Home Assistant established');
                  this.connection = connection; // Save connection for later use
                  resolve();
                }
              }
            });

            // Send authentication token
            connection.sendUTF(JSON.stringify(auth(TOKEN)));
          }
        });
      });

      // Initiate WebSocket connection
      client.connect(WS_URL);
    });
  }

  /**
   * Closes the WebSocket connection
   */
  public disconnect() {
    this.connection.close();
  }

  /**
   * Sends a message to Home Assistant and waits for a response
   */
  private sendMessage(message: { [key: string]: any }): Promise<SuccessMessage> {
    message.id = this.messageId++; // Assign a unique ID to the message
    return new Promise((resolve, reject) => {
      // Listen for a single response message
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

      // Send the message
      this.connection.sendUTF(JSON.stringify(message));
    });
  }

  /**
   * Saves statistics data to Home Assistant
   */
  public async saveStatistics(args: {
    systemId: string;
    ecuId: string;
    name: string;
    stats: StatisticDataPoint[];
  }) {
    const { systemId, ecuId, name, stats } = args;
    const statisticId = getStatisticId(systemId, ecuId);

    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name: name,
        source: statisticId.split(':')[0],
        statistic_id: statisticId,
        unit_of_measurement: 'Wh',
      },
      stats,
    });
  }

  /**
   * Checks if an ECU is new (has no statistics recorded in Home Assistant)
   */
  public async isNewEcu(systemId: string, ecuId: string) {
    const statisticId = getStatisticId(systemId, ecuId);
    const ids = await this.sendMessage({
      type: 'recorder/list_statistic_ids',
      statistic_type: 'sum',
    });
    return !ids.result.find((statistic: any) => statistic.statistic_id === statisticId);
  }

  /**
   * Finds the last statistic data point for a given ECU
   */
  public async findLastStatistic(
    systemId: string,
    ecuId: string,
  ): Promise<null | {
    start: number;
    end: number;
    state: number;
    sum: number;
    change: number;
  }> {
    const isNew = await this.isNewEcu(systemId, ecuId);
    if (isNew) {
      warn(`SystemId/EcuId ${systemId}/${ecuId} not found in Home Assistant statistics`);
      return null;
    }

    const statisticId = getStatisticId(systemId, ecuId);

    // Loop over the last 52 weeks to find statistics
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

    debug(
      `No statistics found for SystemId/EcuId ${systemId}/${ecuId} in Home Assistant`,
    );
    return null;
  }

  /**
   * Purges all statistics for a given ECU
   */
  public async purge(systemId: string, ecuId: string) {
    const statisticId = getStatisticId(systemId, ecuId);
    warn(`Removing all statistics for SystemId/EcuId ${systemId}/${ecuId}`);
    await this.sendMessage({
      type: 'recorder/clear_statistics',
      statistic_ids: [statisticId],
    });
  }
}
