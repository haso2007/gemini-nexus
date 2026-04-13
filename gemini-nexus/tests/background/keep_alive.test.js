import { afterEach, describe, expect, test, vi } from 'vitest';
import { KeepAliveManager } from '../../background/managers/keep_alive.js';

describe('KeepAliveManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  test('registers the alarm listener only once across repeated init calls', () => {
    const listeners = [];

    globalThis.chrome = {
      alarms: {
        get: vi.fn((_name, callback) => callback(null)),
        create: vi.fn(),
        onAlarm: {
          addListener: vi.fn((listener) => listeners.push(listener)),
          hasListener: vi.fn((listener) => listeners.includes(listener)),
        },
      },
    };

    const manager = new KeepAliveManager();
    manager.performRotation = vi.fn();

    manager.init();
    manager.init();

    expect(globalThis.chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
  });
});
