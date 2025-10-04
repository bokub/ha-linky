import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeAssistantClient } from './ha.js';
import dayjs from 'dayjs';

// To mock ws connection
function createMockConnection() {
  return {
    once: vi.fn(),
    on: vi.fn(),
    sendUTF: vi.fn(),
    close: vi.fn(),
  };
}

// To mock sendMessage
function setupClientWithMockedSendMessage(result: any) {
  const client = new HomeAssistantClient() as any;
  client.connection = createMockConnection();
  client.sendMessage = vi.fn().mockResolvedValue(result);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomeAssistantClient', () => {
  it('saveStatistics sends correct params', async () => {
    const client = setupClientWithMockedSendMessage({
      success: true,
      result: {},
    });

    await client.saveStatistics({
      systemId: 'acdc678',
      ecuId: '123def',
      name: 'My Meter',
      stats: [{ start: '2025-09-01T12:00:00+02:00', state: 100, sum: 100 }],
    });

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'recorder/import_statistics',
        metadata: expect.objectContaining({
          has_mean: false,
          has_sum: true,
          name: 'My Meter',
          source: 'apsystems',
          statistic_id: 'apsystems:acdc678_123def',
          unit_of_measurement: 'Wh',
        }),
        stats: expect.objectContaining([{
          start: '2025-09-01T12:00:00+02:00',
          state: 100,
          sum: 100,
        }]),
      }),
    );
  });

  it('isNewEcu returns true if ecuId does not exist', async () => {
    const client = setupClientWithMockedSendMessage({
      success: true,
      result: [{ statistic_id: 'apsystems:other' }],
    });

    const isNew = await client.isNewEcu('acdc678', '123def');
    expect(isNew).toBe(true);
  });

  it('isNewEcu returns false if ecuId already exist', async () => {
    const client = setupClientWithMockedSendMessage({
      success: true,
      result: [{ statistic_id: 'apsystems:acdc678_123def' }],
    });

    const isNew = await client.isNewEcu('acdc678', '123def');
    expect(isNew).toBe(false);
  });

  it('findLastStatistic returns null if isNewEcu is true', async () => {
    const client = setupClientWithMockedSendMessage({
      success: true,
      result: [],
    });
    client.isNewEcu = vi.fn().mockResolvedValue(true);

    const result = await client.findLastStatistic('acdc678', '123def');
    expect(result).toBeNull();
  });

  it('findLastStatistic returns the last found point', async () => {
    const lastPoint = {
      start: dayjs().subtract(1, 'day').toISOString(),
      state: 100,
      sum: 500,
    };

    const client = setupClientWithMockedSendMessage({
      success: true,
      result: { 'apsystems:acdc678_123def': [lastPoint] },
    });
    client.isNewEcu = vi.fn().mockResolvedValue(false);

    const result = await client.findLastStatistic('acdc678', '123def');
    expect(result).toEqual(lastPoint);
  });

  it('purge sends correct params', async () => {
    const client = setupClientWithMockedSendMessage({ success: true });

    await client.purge('acdc678', '123def');

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'recorder/clear_statistics',
        statistic_ids: ['apsystems:acdc678_123def'],
      }),
    );
  });
});
