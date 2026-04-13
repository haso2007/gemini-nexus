import { describe, expect, test } from 'vitest';
import {
  addServerState,
  buildEnabledTools,
  removeActiveServerState,
  resolveTransportFieldState,
} from '../../sandbox/ui/settings/sections/connection_server_actions.js';

describe('connection server actions', () => {
  test('adds a server and makes it active', () => {
    const state = addServerState([{ id: 'srv_1' }], () => ({ id: 'srv_2', enabled: true }));
    expect(state.servers.map((server) => server.id)).toEqual(['srv_1', 'srv_2']);
    expect(state.activeServerId).toBe('srv_2');
  });

  test('removes active server and creates a disabled default when list becomes empty', () => {
    const state = removeActiveServerState([{ id: 'srv_1', enabled: true }], 'srv_1', () => ({ id: 'srv_2', enabled: true }));
    expect(state.servers).toEqual([{ id: 'srv_2', enabled: false }]);
    expect(state.activeServerId).toBe('srv_2');
  });

  test('resolves transport placeholder and url replacement when switching transports', () => {
    const result = resolveTransportFieldState({
      server: { transport: 'sse' },
      nextTransport: 'ws',
      currentUrl: 'http://127.0.0.1:3006/sse',
      getDefaultUrlForTransport: (transport) => transport === 'ws' ? 'ws://127.0.0.1:3006/mcp' : 'http://127.0.0.1:3006/sse',
    });

    expect(result).toEqual({
      placeholder: 'ws://127.0.0.1:3006/mcp',
      value: 'ws://127.0.0.1:3006/mcp',
    });
  });

  test('extracts enabled tool names from cached tools', () => {
    expect(buildEnabledTools([{ name: 'fetch' }, { name: 'search' }, { nope: true }])).toEqual(['fetch', 'search']);
  });
});
