import { describe, expect, test } from 'vitest';
import {
  applyServerFormState,
  buildServerOptions,
  getActiveServer,
  getServerFormState,
} from '../../sandbox/ui/settings/sections/connection_server_state.js';

describe('connection server state helpers', () => {
  const servers = [
    { id: 'srv_1', name: 'Local Proxy', transport: 'sse', url: 'http://127.0.0.1:3006/sse', enabled: true, toolMode: 'all', enabledTools: [] },
    { id: 'srv_2', name: '', transport: 'ws', url: 'ws://127.0.0.1:3006/mcp', enabled: false, toolMode: 'selected', enabledTools: ['fetch'] },
  ];

  test('returns the active server or falls back to the first one', () => {
    expect(getActiveServer(servers, 'srv_2')).toBe(servers[1]);
    expect(getActiveServer(servers, 'missing')).toBe(servers[0]);
  });

  test('applies form state to a server and detects connection-key changes', () => {
    const server = { ...servers[0] };
    const changed = applyServerFormState(server, {
      name: 'Updated',
      transport: 'ws',
      url: 'ws://127.0.0.1:3006/mcp',
      enabled: false,
      toolMode: 'selected',
    });

    expect(changed).toBe(true);
    expect(server).toMatchObject({
      name: 'Updated',
      transport: 'ws',
      url: 'ws://127.0.0.1:3006/mcp',
      enabled: false,
      toolMode: 'selected',
    });
  });

  test('builds form state and select labels from server data', () => {
    expect(getServerFormState(servers[0], () => 'placeholder')).toEqual({
      id: 'srv_1',
      name: 'Local Proxy',
      transport: 'sse',
      url: 'http://127.0.0.1:3006/sse',
      urlPlaceholder: 'placeholder',
      enabled: true,
      toolMode: 'all',
    });

    expect(buildServerOptions(servers)).toEqual([
      { value: 'srv_1', label: '✓ Local Proxy' },
      { value: 'srv_2', label: '✗ ws://127.0.0.1:3006/mcp' },
    ]);
  });
});
