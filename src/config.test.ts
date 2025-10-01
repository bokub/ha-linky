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

  it('Parses complete config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [{
        "systemId": "123456789",
        "ecuId": "a1b2c",
        "name": "MyAPSys1",
        "action": "sync"
      }, {
        "systemId": "123456789",
        "ecuId": "d3e4f",
        "name": "MyAPSys2",
        "action": "sync"
      }],
      "openapi": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: '246bdf', appSecret: '135ace' },
      meters: [
        { action: 'sync', name: 'MyAPSys1', systemId: '123456789', ecuId: 'a1b2c' },
        { action: 'sync', name: 'MyAPSys2', systemId: '123456789', ecuId: 'd3e4f' },
      ],
    });
  });

  it('Parses partial config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [{
        "systemId": "123456789",
        "ecuId": "a1b2c"
      }, {
        "systemId": "123456789",
        "ecuId": "d3e4f"
      }],
      "openapi": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: '246bdf', appSecret: '135ace' },
      meters: [
        { action: 'sync', name: 'APSystems', systemId: '123456789', ecuId: 'a1b2c' },
        { action: 'sync', name: 'APSystems', systemId: '123456789', ecuId: 'd3e4f' },
      ],
    });
  });

  it('Parses another partial config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [{
        "systemId": "123456789",
        "ecuId": "a1b2c",
        "action": "reset"
      }],
      "openapi": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: '246bdf', appSecret: '135ace' },
      meters: [
        { action: 'reset', name: 'APSystems', systemId: '123456789', ecuId: 'a1b2c' },
      ],
    });
  });

  it('Parses config with duplicate ecusId', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "meters": [{
        "systemId": "123456789",
        "ecuId": "a1b2c",
        "action": "sync"
      }, {
        "systemId": "123456789",
        "ecuId": "a1b2c",
        "action": "reset"
      }],
      "openapi": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(() => getUserConfig()).toThrowError(
      'SystemId/EcuId 123456789/a1b2c is configured multiple times',
    );
  });
});
