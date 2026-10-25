import { readFileSync } from 'node:fs';

export type MeterConfig = {
  prm: string;
  token: string;
  name: string;
  action: 'sync' | 'reset';
  production: boolean;
  costs?: CostConfig[];
};

export type CostConfig = {
  price?: number;
  entity_id?: string;
  daily_fee?: number; // Fixed cost in € per day (e.g. subscription), not compatible with time-based filters
  after?: string;
  before?: string;
  weekday?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  start_date?: string;
  end_date?: string;
};

export type UserConfig = { meters: MeterConfig[] };

export function getUserConfig(): UserConfig {
  let parsed: { meters?: any[]; costs?: any } = {};

  try {
    parsed = JSON.parse(readFileSync('/data/options.json', 'utf8'));
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }

  const result: UserConfig = { meters: [] };

  if (parsed.meters && Array.isArray(parsed.meters) && parsed.meters.length > 0) {
    for (const meter of parsed.meters) {
      if (meter.prm && meter.token) {
        const resultMeter: MeterConfig = {
          prm: meter.prm.toString(),
          token: meter.token,
          name: meter.name || 'Linky',
          action: meter.action === 'reset' ? 'reset' : 'sync',
          production: meter.production === true,
        };
        if (Array.isArray(parsed.costs)) {
          const prmCostConfigs = parsed.costs
            .filter((cost) => (cost.production === true) === (meter.production === true))
            .filter((cost) => !cost.prm || cost.prm === meter.prm);
          if (prmCostConfigs.length > 0) {
            resultMeter.costs = [];
            for (const cost of prmCostConfigs) {
              const hasPrice = cost.price && typeof cost.price === 'number';
              const hasEntityId = cost.entity_id && typeof cost.entity_id === 'string';
              const hasDailyFee = cost.daily_fee && typeof cost.daily_fee === 'number';

              if (hasDailyFee) {
                if (hasPrice || hasEntityId || cost.after || cost.before || cost.weekday) {
                  throw new Error(
                    `Cost configuration error for PRM ${meter.prm}: 'daily_fee' cannot be combined with 'price', 'entity_id' or time-based filters ('after', 'before', 'weekday').`,
                  );
                }
                const resultFee: CostConfig = { daily_fee: cost.daily_fee };
                if (cost.start_date && typeof cost.start_date === 'string') {
                  resultFee.start_date = cost.start_date;
                }
                if (cost.end_date && typeof cost.end_date === 'string') {
                  resultFee.end_date = cost.end_date;
                }
                resultMeter.costs.push(resultFee);
                continue;
              }

              if (hasPrice && hasEntityId) {
                throw new Error(
                  `Cost configuration error for PRM ${meter.prm}: cannot specify both 'price' and 'entity_id' in the same configuration item. Choose one or the other.`,
                );
              }

              if (!hasPrice && !hasEntityId) {
                throw new Error(
                  `Cost configuration error for PRM ${meter.prm}: you must specify either 'price' or 'entity_id' in each cost configuration item.`,
                );
              }

              // Validate that time-based filters are not used with entity_id
              if (hasEntityId) {
                if (cost.after || cost.before || cost.weekday) {
                  throw new Error(
                    `Cost configuration error for PRM ${meter.prm}: cannot use time-based filters ('after', 'before', 'weekday') with 'entity_id'. Use separate configuration items with 'price' if you need time-based filtering.`,
                  );
                }
              }

              const resultCost: CostConfig = {};

              // Add price or entity_id (mutually exclusive)
              if (hasPrice) {
                resultCost.price = cost.price;
              } else {
                resultCost.entity_id = cost.entity_id;
              }

              // Time-based filters only available with static pricing
              if (hasPrice) {
                if (cost.after && typeof cost.after === 'string') {
                  resultCost.after = cost.after;
                }
                if (cost.before && typeof cost.before === 'string') {
                  resultCost.before = cost.before;
                }
                if (cost.weekday && Array.isArray(cost.weekday)) {
                  resultCost.weekday = cost.weekday;
                }
              }

              // Date filters available for both modes
              if (cost.start_date && typeof cost.start_date === 'string') {
                resultCost.start_date = cost.start_date;
              }
              if (cost.end_date && typeof cost.end_date === 'string') {
                resultCost.end_date = cost.end_date;
              }

              resultMeter.costs.push(resultCost);
            }
          }
        }
        result.meters.push(resultMeter);
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
