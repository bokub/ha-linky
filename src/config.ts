import { readFileSync } from 'fs';

export type MeterConfig = {
  prm: string;
  token: string;
  name: string;
  action: 'sync' | 'reset';
  isProduction: boolean;
};

export type UserConfig = {
  consumption?: MeterConfig;
  production?: MeterConfig;
};

export function getUserConfig(): UserConfig {
  try {
    const parsed: {
      'consumption PRM'?: string;
      'consumption token'?: string;
      'consumption name'?: string;
      'consumption action'?: string;
      'production PRM'?: string;
      'production token'?: string;
      'production name'?: string;
      'production action'?: string;
    } = JSON.parse(readFileSync('/data/options.json', 'utf8'));

    return {
      consumption:
        parsed['consumption PRM'] && parsed['consumption token']
          ? {
              prm: parsed['consumption PRM'],
              token: parsed['consumption token'],
              name: parsed['consumption name'] || 'Linky consumption',
              action: parsed['consumption action'] === 'reset' ? 'reset' : 'sync',
              isProduction: false,
            }
          : undefined,
      production:
        parsed['production PRM'] && parsed['production token']
          ? {
              prm: parsed['production PRM'],
              token: parsed['production token'],
              name: parsed['production name'] || 'Linky production',
              action: parsed['production action'] === 'reset' ? 'reset' : 'sync',
              isProduction: true,
            }
          : undefined,
    };
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }
}
