import { describe, expect, test, vi } from 'vitest';
import { openMcpWebSocket } from '../../background/managers/mcp_transport_ws.js';

describe('mcp websocket transport', () => {
  test('opens websocket and forwards parsed rpc messages', async () => {
    const instances = [];

    class FakeWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.listeners = new Map();
        instances.push(this);
      }

      addEventListener(type, handler) {
        this.listeners.set(type, handler);
      }

      emit(type, payload) {
        const handler = this.listeners.get(type);
        if (handler) handler(payload);
      }
    }

    const conn = {};
    const onRpcMessage = vi.fn();
    const onClose = vi.fn();

    const opening = openMcpWebSocket({
      conn,
      wsUrl: 'ws://127.0.0.1:3006/mcp',
      onRpcMessage,
      onClose,
      WebSocketImpl: FakeWebSocket,
    });

    instances[0].emit('open');
    await opening;

    instances[0].emit('message', { data: '{"id":1,"result":{"ok":true}}' });

    expect(conn.ws).toBe(instances[0]);
    expect(onRpcMessage).toHaveBeenCalledWith({ id: 1, result: { ok: true } });
    expect(onClose).not.toHaveBeenCalled();
  });
});
