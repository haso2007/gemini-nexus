import { describe, expect, test } from 'vitest';
import {
  DEFAULT_MCP_URL,
  createDefaultMcpServer,
  getEnabledMcpServers,
  normalizeMcpConnection,
  serializeMcpConnection,
} from '../../lib/mcp_servers.js';

describe('mcp server helpers', () => {
  test('normalizes legacy single-server settings into mcpServers', () => {
    const normalized = normalizeMcpConnection({
      mcpEnabled: true,
      mcpTransport: 'ws',
      mcpServerUrl: 'ws://127.0.0.1:3006/mcp',
    });

    expect(normalized.mcpEnabled).toBe(true);
    expect(normalized.mcpServers).toHaveLength(1);
    expect(normalized.mcpServers[0].transport).toBe('ws');
    expect(normalized.mcpServers[0].url).toBe('ws://127.0.0.1:3006/mcp');
  });

  test('serializes only the multi-server shape', () => {
    const serialized = serializeMcpConnection({
      mcpEnabled: true,
      mcpServers: [createDefaultMcpServer({ id: 'srv_1', url: DEFAULT_MCP_URL })],
      mcpTransport: 'sse',
      mcpServerUrl: DEFAULT_MCP_URL,
    });

    expect(serialized).toEqual({
      mcpEnabled: true,
      mcpServers: [
        expect.objectContaining({
          id: 'srv_1',
          transport: 'sse',
          url: DEFAULT_MCP_URL,
        }),
      ],
      mcpActiveServerId: 'srv_1',
    });
    expect(serialized).not.toHaveProperty('mcpTransport');
    expect(serialized).not.toHaveProperty('mcpServerUrl');
  });

  test('returns only enabled servers with non-empty urls', () => {
    const servers = getEnabledMcpServers({
      mcpEnabled: true,
      mcpServers: [
        createDefaultMcpServer({ id: 'enabled', enabled: true, url: DEFAULT_MCP_URL }),
        createDefaultMcpServer({ id: 'disabled', enabled: false, url: DEFAULT_MCP_URL }),
        createDefaultMcpServer({ id: 'empty', enabled: true, url: '' }),
      ],
    });

    expect(servers.map((server) => server.id)).toEqual(['enabled']);
  });
});
