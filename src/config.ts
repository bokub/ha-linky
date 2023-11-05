import { readFileSync } from 'fs';

export type UserConfig = {
  consumption?: {
    prm: string;
    token: string;
    name: string;
    action: 'sync' | 'reset';
  };
  production?: {
    prm: string;
    token: string;
    name: string;
    action: 'yes' | 'non';
  };
};

export function getUserConfig(): UserConfig {
  try {
    const parsed: {
      PRM?: string;
      token?: string;
      'consumption name'?: string;
      action?: string;
      'production name'?: string;
      'sync production'?: string;
    } = JSON.parse(readFileSync('/data/options.json', 'utf8'));

    return {
      consumption:
        parsed['PRM'] && parsed['token']
          ? {
              prm: parsed['PRM'],
              token: parsed['token'],
              name: parsed['consumption name'] || 'Linky consumption',
              action: parsed['action'] === 'reset' ? 'reset' : 'sync',
            }
          : undefined,
      production:
        parsed['PRM'] && parsed['token']
          ? {
              prm: parsed['PRM'],
              token: parsed['token'],
              name: parsed['production name'] || 'Linky consumption',
              action: parsed['sync production'] === 'yes' ? 'yes' : 'non',
            }
          : undefined,
    };
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }
}
