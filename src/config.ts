import { readFileSync } from 'node:fs';

export type MeterConfig = {
  prm: string;
  token: string;
  name: string;
  action: 'sync' | 'reset';
  production: boolean;
};

export type UserConfig = { meters: MeterConfig[] };

export function getUserConfig(): UserConfig {
  let parsed: { meters?: any[] } = {};

  try {
    parsed = JSON.parse(readFileSync('/data/options.json', 'utf8'));
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }

  const result: UserConfig = { meters: [] };

  if (parsed.meters && Array.isArray(parsed.meters) && parsed.meters.length > 0) {
    for (const meter of parsed.meters) {
      if (meter.prm && meter.token) {
        result.meters.push({
          prm: meter.prm.toString(),
          token: meter.token,
          name: meter.name || 'Linky',
          action: meter.action === 'reset' ? 'reset' : 'sync',
          production: meter.production === true,
        });
      }
    }
  }

  for (const m in result.meters) {
    for (const n in result.meters) {
      if (
        m !== n &&
        result.meters[m].prm === result.meters[n].prm &&
        result.meters[m].production === result.meters[n].production
      ) {
        throw new Error(
          `PRM ${result.meters[m].prm} is configured multiple times in ${
            result.meters[m].production ? 'production' : 'consumption'
          } mode`,
        );
      }
    }
  }

  return result;
}
