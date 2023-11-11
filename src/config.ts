import { readFileSync } from 'fs';

export type UserConfig = {
  consumption?: {
    sync: boolean;
    prm: string;
    token: string;
    name: string;
    action: 'sync' | 'reset';
  };
  production?: {
    sync: boolean;
    prm: string;
    token: string;
    name: string;
    action: 'sync' | 'reset';
  };
};

export function getUserConfig(): UserConfig {
  try {
    const parsed: {
      'Consumption Sync'?: boolean;
      'Consumption PRM'?: string;
      'Consumption Token'?: string;
      'Consumption Action'?: string;
      'Production Sync'?: boolean;
      'Production PRM'?: string;
      'Production Token'?: string;
      'Production Action'?: string;
    } = JSON.parse(readFileSync('/data/options.json', 'utf8'));

    return {
      consumption:
        parsed['Consumption PRM'] && parsed['Consumption Token']
          ? {
              sync: parsed['Consumption Sync'],
              prm: parsed['Consumption PRM'],
              token: parsed['Consumption Token'],
              name: parsed['Consumption Name'] || 'Linky consumption',
              action: parsed['consumption_action'] === 'reset' ? 'reset' : 'sync',
            }
          : undefined,
      production:
        parsed['Production PRM'] && parsed['Production Token']
          ? {
              sync: parsed['Production Sync'],
              prm: parsed['Production PRM'],
              token: parsed['Production Token'],
              name: parsed['Production Name'] || 'Linky consumption',
              action: parsed['Production Action'] === 'reset' ? 'reset' : 'sync',
            }
          : undefined,
    };
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }
}
