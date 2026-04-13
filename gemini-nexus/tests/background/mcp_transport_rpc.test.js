import { describe, expect, test, vi } from 'vitest';
import {
  handleRpcMessage,
  sendNotificationMessage,
  sendRpcMessage,
} from '../../background/managers/mcp_transport_rpc.js';

describe('mcp transport rpc helpers', () => {
  test('resolves pending rpc entries from incoming messages', () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const timeout = setTimeout(() => {}, 1000);
    const conn = { pending: new Map([[1, { resolve, reject, timeout }]]) };

    handleRpcMessage(conn, { id: 1, result: { ok: true } });

    expect(resolve).toHaveBeenCalledWith({ ok: true });
    expect(reject).not.toHaveBeenCalled();
    expect(conn.pending.size).toBe(0);
  });

  test('sends notifications through the provided sender', () => {
    const sender = vi.fn();
    sendNotificationMessage(sender, 'notifications/initialized', { ready: true });
    expect(sender).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: { ready: true },
    });
  });

  test('creates rpc messages and stores pending resolvers', async () => {
    const conn = { pending: new Map() };
    const sender = vi.fn();
    const promise = sendRpcMessage(conn, () => 7, sender, 'tools/list', {});

    expect(sender).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/list',
      params: {},
    });
    expect(conn.pending.has(7)).toBe(true);

    handleRpcMessage(conn, { id: 7, result: { tools: [] } });
    await expect(promise).resolves.toEqual({ tools: [] });
  });
});
