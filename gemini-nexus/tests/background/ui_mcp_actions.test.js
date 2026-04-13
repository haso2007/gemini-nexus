import { describe, expect, test, vi } from 'vitest';
import { UIMcpActions } from '../../background/handlers/ui_mcp_actions.js';

describe('UIMcpActions', () => {
  test('returns MCP test success payload', async () => {
    const mcpManager = {
      listToolsForServer: vi.fn().mockResolvedValue([{ name: 'fetch' }, { name: 'search' }]),
    };
    const actions = new UIMcpActions(mcpManager);
    const sendResponse = vi.fn();

    await actions.testConnection({
      serverId: 'srv_1',
      transport: 'ws',
      url: 'ws://127.0.0.1:3006/mcp',
    }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      action: 'MCP_TEST_RESULT',
      ok: true,
      toolsCount: 2,
      serverId: 'srv_1',
    }));
  });

  test('returns UI-safe tool list payload', async () => {
    const mcpManager = {
      listToolsForServer: vi.fn().mockResolvedValue([
        { name: 'fetch', description: 'Fetch data', inputSchema: { foo: 'bar' } },
      ]),
    };
    const actions = new UIMcpActions(mcpManager);
    const sendResponse = vi.fn();

    await actions.listTools({
      serverId: 'srv_1',
      transport: 'sse',
      url: 'http://127.0.0.1:3006/sse',
    }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      action: 'MCP_TOOLS_RESULT',
      ok: true,
      serverId: 'srv_1',
      transport: 'sse',
      url: 'http://127.0.0.1:3006/sse',
      tools: [{ name: 'fetch', description: 'Fetch data' }],
    });
  });
});
