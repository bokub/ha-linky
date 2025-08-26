import { readFileSync } from 'node:fs';

export type APSystemsConfig = {
  systemId: string;
  ecuIds: string[];
  name: string;
  action: 'sync' | 'reset';
};

export type OpenapiConfig = {
  appId: string;
  appSecret: string;
};

export type UserConfig = { aps: APSystemsConfig, api: OpenapiConfig };

export function getUserConfig(): UserConfig {
  let parsed: { aps?: any; api?: any; } = {};

  try {
    parsed = JSON.parse(readFileSync('/data/options.json', 'utf8'));
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }

  const result: UserConfig = { aps: null, api: null };

  // Get OpenAPI config part
  if (parsed.api && parsed.api.appId && parsed.api.appSecret) {
      const resultApi: OpenapiConfig = {
          appId: parsed.api.appId,
          appSecret: parsed.api.appSecret,
      };
      result.api = resultApi;
  }

  // Get APSystems devices config part
  if (parsed.aps && parsed.aps.systemId && parsed.aps.ecuIds &&
      Array.isArray(parsed.aps.ecuIds) && parsed.aps.ecuIds.length > 0) {
    const resultEcu: APSystemsConfig = {
      systemId: parsed.aps.systemId,
      ecuIds: parsed.aps.ecuIds,
      name: parsed.aps.name || 'APSystems',
      action: parsed.aps.action === 'reset' ? 'reset' : 'sync',
    };
    result.aps = resultEcu;
  }
  //Suppress duplicate ecu ids
  result.aps.ecuIds = Array.from(new Set(result.aps.ecuIds));

  return result;
}
