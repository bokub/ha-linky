import { expect, it, vi, describe, beforeEach } from 'vitest';
import { getUserConfig } from './config.js';
import { readFileSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

describe('getUserConfig', () => {
  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  it('Parses basic config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [
        { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" },
        { "prm": "123", "token": "ppp", "name": "Prod", "action": "reset", "production": true }
      ],
      "costs": [{ "price": 0.1, "start_date": "2024-07-01", "prm": "123" }]
    }`);
    expect(getUserConfig()).toEqual({
      meters: [
        {
          action: 'sync',
          name: 'Conso',
          prm: '123',
          production: false,
          token: 'ccc',
          costs: [{ price: 0.1, start_date: '2024-07-01' }],
        },
        { action: 'reset', name: 'Prod', prm: '123', production: true, token: 'ppp' },
      ],
    });
  });

  it('Throws if a PRM is configured multiple times', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [
        { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" },
        { "prm": "123", "token": "ppp", "name": "Prod", "action": "reset", "production": true },
        { "prm": "123", "token": "ddd", "name": "Clone", "action": "sync", "production": false }
      ]
    }`);

    expect(() => getUserConfig()).toThrowError('PRM 123 is configured multiple times in consumption mode');
  });

  it('Handles costs correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [
        { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" },
        { "prm": "1234", "token": "cccc", "name": "Conso 2", "action": "sync" },
        { "prm": "123", "token": "ppp", "name": "Prod", "action": "sync", "production": true },
        { "prm": "1234", "token": "pppp", "name": "Prod 2", "action": "sync", "production": true }
      ],
      "costs": [
        { "price": 0.1, "prm": "123" },
        { "entity_id": "sensor.electricity_price", "prm": "123" },
        { "price": 0.2, "prm": "1234", "production": true },
        { "price": 0.3 },
        { "price": 0.4, "production": true }
      ]
    }`);
    expect(getUserConfig()).toEqual({
      meters: [
        {
          action: 'sync',
          name: 'Conso',
          prm: '123',
          production: false,
          token: 'ccc',
          costs: [{ price: 0.1 }, { entity_id: 'sensor.electricity_price' }, { price: 0.3 }],
        },
        {
          action: 'sync',
          name: 'Conso 2',
          prm: '1234',
          production: false,
          token: 'cccc',
          costs: [{ price: 0.3 }],
        },
        {
          action: 'sync',
          name: 'Prod',
          prm: '123',
          production: true,
          token: 'ppp',
          costs: [{ price: 0.4 }],
        },
        {
          action: 'sync',
          name: 'Prod 2',
          prm: '1234',
          production: true,
          token: 'pppp',
          costs: [{ price: 0.2 }, { price: 0.4 }],
        },
      ],
    });
  });

  it('Throws if both price and entity_id are specified', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [
        { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" }
      ],
      "costs": [
        { "price": 0.25, "entity_id": "sensor.electricity_price", "prm": "123" }
      ]
    }`);

    expect(() => getUserConfig()).toThrowError(
      "Cost configuration error for PRM 123: cannot specify both 'price' and 'entity_id' in the same configuration item. Please use either static pricing (price) or dynamic pricing (entity_id), but not both.",
    );
  });

  const timeBasedFilters = [
    { filter: 'after', value: '"08:00"', field: 'after' },
    { filter: 'before', value: '"20:00"', field: 'before' },
    { filter: 'weekday', value: '["mon", "tue"]', field: 'weekday' },
  ];

  for (const { filter, value, field } of timeBasedFilters) {
    it(`Throws if entity_id is used with ${filter}`, () => {
      vi.mocked(readFileSync).mockReturnValue(`{
        "meters": [
          { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" }
        ],
        "costs": [
          { "entity_id": "sensor.electricity_price", "${field}": ${value}, "prm": "123" }
        ]
      }`);

      expect(() => getUserConfig()).toThrowError(
        "Cost configuration error for PRM 123: cannot use time-based filters ('after', 'before', 'weekday') with 'entity_id'",
      );
    });
  }

  it('Accepts entity_id with start_date and end_date', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [
        { "prm": "123", "token": "ccc", "name": "Conso", "action": "sync" }
      ],
      "costs": [
        { "entity_id": "sensor.electricity_price", "start_date": "2024-01-01", "end_date": "2024-12-31", "prm": "123" }
      ]
    }`);

    expect(getUserConfig()).toEqual({
      meters: [
        {
          action: 'sync',
          name: 'Conso',
          prm: '123',
          production: false,
          token: 'ccc',
          costs: [{ entity_id: 'sensor.electricity_price', start_date: '2024-01-01', end_date: '2024-12-31' }],
        },
      ],
    });
  });
});
