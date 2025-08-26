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
      "aps": {
        "systemId": "123456789",
        "ecuIds": ["a1b2c", "d3e4f"],
        "name": "MyAPSys",
        "action": "sync"
      },
      "api": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: "246bdf", appSecret: "135ace" },
      aps: {
        action: "sync", name: "MyAPSys", systemId: "123456789", ecuIds: ["a1b2c", "d3e4f"]
      }
    });
  });

  it('Parses partial config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "aps": {
        "systemId": "123456789",
        "ecuIds": ["a1b2c", "d3e4f"]
      },
      "api": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: "246bdf", appSecret: "135ace" },
      aps: {
        action: "sync", name: "APSystems", systemId: "123456789", ecuIds: ["a1b2c", "d3e4f"]
      }
    });
  });

  it('Parses another partial config correctly', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "aps": {
        "systemId": "123456789",
        "ecuIds": ["a1b2c"],
        "action": "reset"
      },
      "api": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: "246bdf", appSecret: "135ace" },
      aps: {
        action: "reset", name: "APSystems", systemId: "123456789", ecuIds: ["a1b2c"]
      }
    });
  });

  it('Parses config with duplicate ecusId', () => {
    vi.mocked(readFileSync).mockReturnValue(`{
      "aps": {
        "systemId": "123456789",
        "ecuIds": ["a1b2c", "d3e4f", "a1b2c", "f57e32"],
        "action": "sync"
      },
      "api": { "appId": "246bdf", "appSecret": "135ace" }
    }`);
    expect(getUserConfig()).toEqual({
      api: { appId: "246bdf", appSecret: "135ace" },
      aps: {
        action: "sync", name: "APSystems", systemId: "123456789", ecuIds: ["a1b2c", "d3e4f", "f57e32"]
      }
    });
  });
});

