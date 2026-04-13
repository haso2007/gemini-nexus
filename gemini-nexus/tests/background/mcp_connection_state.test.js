import { describe, expect, test, vi } from 'vitest';
import {
  bumpIdleClose,
  clearIdleTimer,
  clearPending,
  createConnectionState,
  disconnectState,
} from '../../background/managers/mcp_connection_state.js';

describe('mcp connection state helpers', () => {
  test('creates a fresh connection state shape', () => {
    const state = createConnectionState();

    expect(state.pending).toBeInstanceOf(Map);
    expect(state.initialized).toBe(false);
    expect(state.transport).toBe(null);
  });

  test('clears pending requests and transport handles on disconnect', () => {
    const reject = vi.fn();
    const timeout = setTimeout(() => {}, 1000);
    const state = createConnectionState();
    state.pending.set(1, { reject, timeout });
    state.ws = { close: vi.fn() };
    state.sseAbort = { abort: vi.fn() };
    state.httpPostUrl = 'http://127.0.0.1';
    state.transport = 'ws';
    state.initialized = true;
    state.configKey = 'key';

    disconnectState(state);

    expect(reject).toHaveBeenCalledTimes(1);
    expect(state.pending.size).toBe(0);
    expect(state.ws).toBe(null);
    expect(state.sseAbort).toBe(null);
    expect(state.httpPostUrl).toBe(null);
    expect(state.initialized).toBe(false);
  });

  test('replaces idle timers when bumped', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const state = createConnectionState();

    bumpIdleClose(state, onIdle, 10);
    const firstTimer = state.idleCloseTimer;
    bumpIdleClose(state, onIdle, 10);

    expect(state.idleCloseTimer).not.toBe(firstTimer);
    vi.advanceTimersByTime(10);
    expect(onIdle).toHaveBeenCalledTimes(1);
    clearIdleTimer(state);
    vi.useRealTimers();
  });

  test('clearPending rejects all tracked requests', () => {
    const state = createConnectionState();
    const rejectA = vi.fn();
    const rejectB = vi.fn();
    state.pending.set(1, { reject: rejectA, timeout: setTimeout(() => {}, 1000) });
    state.pending.set(2, { reject: rejectB, timeout: setTimeout(() => {}, 1000) });

    clearPending(state, new Error('closed'));

    expect(rejectA).toHaveBeenCalledTimes(1);
    expect(rejectB).toHaveBeenCalledTimes(1);
    expect(state.pending.size).toBe(0);
  });
});
