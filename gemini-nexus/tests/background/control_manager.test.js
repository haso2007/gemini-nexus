import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BrowserControlManager } from '../../background/managers/control_manager.js';

describe('BrowserControlManager', () => {
  beforeEach(() => {
    globalThis.chrome = {
      tabs: {
        onUpdated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        query: vi.fn().mockResolvedValue([{ id: 7, url: 'https://example.com' }]),
        get: vi.fn().mockResolvedValue({ id: 7, url: 'https://example.com' }),
      },
      debugger: {
        onEvent: { addListener: vi.fn() },
        onDetach: { addListener: vi.fn() },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  test('reports failure when attach does not establish a debugger session', async () => {
    const manager = new BrowserControlManager();
    manager.lockedTabId = 7;
    manager.connection.attach = vi.fn().mockImplementation(async () => {
      manager.connection.attached = false;
    });

    await expect(manager.ensureConnection()).resolves.toBe(false);
  });
});
