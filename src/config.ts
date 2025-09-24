import { readFileSync } from 'node:fs';

export type MeterConfig = {
  systemId: string;
  ecuId: string;
  name: string;
  action: 'sync' | 'reset';
};

export type OpenapiConfig = {
  appId: string;
  appSecret: string;
};

export type UserConfig = { meters: MeterConfig[], api: OpenapiConfig };

export function getUserConfig(): UserConfig {
  let parsed: { meters?: any[]; openapi?: any; } = {};

  try {
    parsed = JSON.parse(readFileSync('/data/options.json', 'utf8'));
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }

  const result: UserConfig = { meters: [], api: null };

  // Get OpenAPI config part
  if (parsed.openapi && parsed.openapi.appId && parsed.openapi.appSecret) {
      const resultApi: OpenapiConfig = {
          appId: parsed.openapi.appId,
          appSecret: parsed.openapi.appSecret,
      };
      result.api = resultApi;
  }

  // Get APSystems devices config part
  if (parsed.meters && Array.isArray(parsed.meters) && parsed.meters.length > 0) {
    for (const meter of parsed.meters) {
      if (meter.systemId && meter.ecuId) {
        const resultMeter: MeterConfig = {
          systemId: meter.systemId,
          ecuId: meter.ecuId,
          name: meter.name || 'APSystems',
          action: meter.action === 'reset' ? 'reset' : 'sync',
        };
        result.meters.push(resultMeter);
      }
    }
  }
  //Suppress duplicate system/ecu ids
  for (const m in result.meters) {
    for (const n in result.meters) {
      if (
        m !== n &&
        result.meters[m].systemId === result.meters[n].systemId &&
        result.meters[m].ecuId === result.meters[n].ecuId
      ) {
        throw new Error(
          `SystemId/EcuId ${result.meters[m].systemId}/${result.meters[m].ecuId} `+
          `is configured multiple times`
        );
      }
    }
  }

  return result;
}
