import { describe, expect, test, vi } from 'vitest';
import { createSseDispatcher } from '../../background/managers/mcp_transport_sse.js';

describe('mcp sse transport', () => {
  test('captures endpoint events and forwards rpc messages', () => {
    const conn = {
      ssePostUrl: null,
      _resolveSseEndpoint: vi.fn(),
    };
    const onRpcMessage = vi.fn();
    const dispatch = createSseDispatcher(conn, new URL('http://127.0.0.1:3006/sse'), onRpcMessage);

    dispatch('endpoint', '/mcp');
    dispatch('message', '{"id":2,"result":{"ok":true}}');

    expect(conn.ssePostUrl).toBe('http://127.0.0.1:3006/mcp');
    expect(conn._resolveSseEndpoint).toHaveBeenCalledWith('http://127.0.0.1:3006/mcp');
    expect(onRpcMessage).toHaveBeenCalledWith({ id: 2, result: { ok: true } });
  });
});
