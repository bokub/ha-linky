import axios, { AxiosError } from 'axios';
import qs from 'qs';
import crypto from 'crypto';
import dayjs from 'dayjs';
import { Buffer } from 'buffer';

const OPENAPI_BASE_URL = 'https://api.apsystemsema.com:9282/user/api/v2';

type ApiResponse = {
  code: number;
  data: any[];
};

/**
 * Represents the response containing energy consumption data.
 */
export type EnergyResponse = {
  // Array of energy values measured.
  energy: number[];
};

export class APIError extends Error {
  constructor(
    public err: AxiosError,
    public code: string,
    public response: any,
  ) {
    super('OpenAPI error');
  }

  toString() {
    return (
      `OpenAPI error\nCode: ${this.code}\nResponse: ` +
      JSON.stringify(this.response, null, 4)
    );
  }
}

/**
 * ApsOpenApi is a client for interacting with the APS OpenAPI service.
 *
 * It requires an application ID and secret to authenticate API requests.
 */
export class ApsOpenApi {
  private appId: string;
  private appSecret: string;

  /**
   * Creates a new instance of the ApsOpenApi client.
   *
   * @param appliId - The application identifier used for authentication.
   * @param appliSecret - The application secret key used for authentication.
   * @throws {Error} If either `appliId` or `appliSecret` is missing.
   */
  constructor(
    private appliId: string,
    private appliSecret: string,
  ) {
    if (!appliId || !appliSecret) {
      throw new Error('OpenAPI Id and Secret are mandatory');
    }
    this.appId = appliId;
    this.appSecret = appliSecret;
  }

  /**
   * Retrieves the daily energy consumption for a given ECU.
   *
   * @param systemId - The system identifier.
   * @param ecuId - The ECU identifier.
   * @param monthStr - The target date in `YYYY-MM` format.
   * @returns A promise resolving to the daily energy consumption response.
   * @throws {Error} If `systemId` or `ecuId` are missing.
   * @throws {Error} If `monthStr` is not in the valid `YYYY-MM` format.
   */
  async getEcuDailyConsumption(
    systemId: string,
    ecuId: string,
    monthStr: string,
  ): Promise<number[]> {
    // Check input parameters
    if (!systemId || !ecuId) {
      throw new Error('System and Ecu Ids are mandatory');
    }
    if (!dayjs(monthStr, 'YYYY-MM', true).isValid()) {
      throw new Error(`Invalid Date format: "${monthStr}". Expected: YYYY-MM`);
    }

    // Call remote service
    const result = await this.callApi(`systems/${systemId}/devices/ecu/energy/${ecuId}`, {
      energy_level: 'daily',
      date_range: monthStr,
    });

    // Build response object
    return result.data.map(Number);
  }

  /**
   * Retrieves the hourly energy consumption for a given ECU.
   *
   * @param systemId - The system identifier.
   * @param ecuId - The ECU identifier.
   * @param dayStr - The target date in `YYYY-MM-DD` format.
   * @returns A promise resolving to the hourly energy consumption response.
   * @throws {Error} If `systemId` or `ecuId` are missing.
   * @throws {Error} If `dayStr` is not in the valid `YYYY-MM-DD` format.
   */
  async getEcuHourlyConsumption(
    systemId: string,
    ecuId: string,
    dayStr: string,
  ): Promise<number[]> {
    // Check input parameters
    if (!systemId || !ecuId) {
      throw new Error('System and Ecu Ids are mandatory');
    }
    if (!dayjs(dayStr, 'YYYY-MM-DD', true).isValid()) {
      throw new Error(`Invalid Date format: "${dayStr}". Expected: YYYY-MM-DD`);
    }

    // Call remote service
    const result = await this.callApi(`systems/${systemId}/devices/ecu/energy/${ecuId}`, {
      energy_level: 'hourly',
      date_range: dayStr,
    });

    // Build response object
    return result.data.map(Number);
  }

  private generateSignature(url: string): [string, string, string] {
    // Timestamp in milliseconds
    const timestamp = Date.now().toString();

    // UUID without '-'
    const nonce = crypto.randomUUID().replace(/-/g, '');

    // Get last url segment
    const pathPart = url.split('/').pop() || '';

    // Create string to sign
    const stringToSign = `${timestamp}/${nonce}/${this.appId}/${pathPart}/GET/HmacSHA256`;

    // Create signature using HMAC SHA256
    const signature = crypto
      .createHmac('sha256', this.appSecret)
      .update(stringToSign, 'utf8')
      .digest();

    // Encode signature
    const signatureBase64 = Buffer.from(signature).toString('base64');

    return [signatureBase64, timestamp, nonce];
  }

  private callApi(
    serviceUrl: string,
    params: Record<string, unknown>,
  ): Promise<ApiResponse> {
    // Generate url
    let url = `${OPENAPI_BASE_URL}/${serviceUrl}`;

    // Calculate corresponding signature
    const [signature, timestamp, nonce] = this.generateSignature(url);

    // Add parameters to url
    if (params) {
      url += `?${qs.stringify(params)}`;
    }

    // Call service api
    return axios
      .get<ApiResponse>(url, {
        headers: {
          'X-CA-AppId': this.appId,
          'X-CA-Timestamp': timestamp,
          'X-CA-Nonce': nonce,
          'X-CA-Signature-Method': 'HmacSHA256',
          'X-CA-Signature': signature,
          Accept: 'application/json',
        },
      })
      .then((res) => {
        if (res.data.code === 0 || res.data.code === 1000) {
          return res.data;
        } else if (res.data.code === 2005 || res.data.code >= 7000) {
          throw new Error(
            `OpenAPI access limit: (code:${res.data.code}) ` +
              JSON.stringify(res.data.data),
          );
        } else {
          throw new Error(
            `OpenAPI cannot get result: (code:${res.data.code}) ` +
              JSON.stringify(res.data.data),
          );
        }
      })
      .catch((err) => {
        if (err.response) {
          throw new APIError(err, err.response.status, err.response.data);
        }
        if (err.request) {
          throw new Error(
            `No answer from OpenAPI\nRequest: ` + JSON.stringify(err.request, null, 4),
          );
        }
        throw new Error(`Unable to call OpenAPI\nError: ${err.message}`);
      });
  }
}
