import { describe, expect, test, vi } from 'vitest';
import { McpToolCatalog } from '../../background/managers/mcp_tool_catalog.js';

describe('McpToolCatalog', () => {
  test('lists tools for a server and caches the result on the connection', async () => {
    const conn = { toolsCache: null, toolsCacheAt: 0 };
    const connector = {
      ensureConnectedForServer: vi.fn().mockResolvedValue(conn),
      sendRpc: vi.fn().mockResolvedValue({ tools: [{ name: 'fetch' }] }),
    };
    const catalog = new McpToolCatalog(connector);

    const tools = await catalog.listToolsForServer('srv_1', 'sse', 'http://127.0.0.1:3006/sse');

    expect(connector.ensureConnectedForServer).toHaveBeenCalledWith('srv_1', 'sse', 'http://127.0.0.1:3006/sse');
    expect(connector.sendRpc).toHaveBeenCalledWith(conn, 'tools/list', {});
    expect(tools).toEqual([{ name: 'fetch' }]);
    expect(conn.toolsCache).toEqual([{ name: 'fetch' }]);
  });

  test('tags active tools with server metadata', async () => {
    const connector = {
      ensureConnectedForServer: vi.fn().mockResolvedValue({ toolsCache: null, toolsCacheAt: 0 }),
      sendRpc: vi.fn().mockResolvedValue({ tools: [{ name: 'fetch', description: 'Fetch data' }] }),
    };
    const catalog = new McpToolCatalog(connector);

    const tools = await catalog.listAllActiveTools([
      { id: 'srv_1', name: 'Local', transport: 'sse', url: 'http://127.0.0.1:3006/sse', enabled: true },
    ]);

    expect(tools).toEqual([
      expect.objectContaining({
        name: 'fetch',
        _serverId: 'srv_1',
        _serverName: 'Local',
        _toolId: 'srv_1__fetch',
      }),
    ]);
  });

  test('builds a preamble from selected tools only', async () => {
    const connector = {
      ensureConnectedForServer: vi.fn().mockResolvedValue({ toolsCache: null, toolsCacheAt: 0 }),
      sendRpc: vi.fn().mockResolvedValue({
        tools: [
          { name: 'fetch', description: 'Fetch data', inputSchema: { properties: { url: { type: 'string' } }, required: ['url'] } },
          { name: 'search', description: 'Search data' },
        ],
      }),
    };
    const catalog = new McpToolCatalog(connector);

    const preamble = await catalog.buildToolsPreamble([
      {
        id: 'srv_1',
        name: 'Local',
        transport: 'sse',
        url: 'http://127.0.0.1:3006/sse',
        enabled: true,
        toolMode: 'selected',
        enabledTools: ['fetch'],
      },
    ]);

    expect(preamble).toContain('srv_1__fetch');
    expect(preamble).toContain('{ url: string }');
    expect(preamble).not.toContain('srv_1__search');
  });

  test('routes tool calls by tool id', async () => {
    const conn = { toolsCache: null, toolsCacheAt: 0 };
    const connector = {
      ensureConnectedForServer: vi.fn().mockResolvedValue(conn),
      sendRpc: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    };
    const catalog = new McpToolCatalog(connector);

    const result = await catalog.callToolById('srv_1__fetch', { url: 'https://example.com' }, [
      { id: 'srv_1', transport: 'sse', url: 'http://127.0.0.1:3006/sse' },
    ]);

    expect(connector.sendRpc).toHaveBeenCalledWith(conn, 'tools/call', {
      name: 'fetch',
      arguments: { url: 'https://example.com' },
    });
    expect(result.text).toBe('ok');
  });
});
