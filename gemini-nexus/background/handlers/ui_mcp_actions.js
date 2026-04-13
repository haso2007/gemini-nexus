import { buildMcpRequestConfig, mapToolsForUi } from './ui_helpers.js';

export class UIMcpActions {
  constructor(mcpManager) {
    this.mcpManager = mcpManager;
  }

  async testConnection(request, sendResponse) {
    try {
      if (!this.mcpManager) throw new Error('MCP manager not available');
      const { transport, url } = buildMcpRequestConfig(request);
      if (!url) throw new Error('Server URL is empty');

      const tools = await this.mcpManager.listToolsForServer(
        request.serverId || 'mcp_test_connection',
        transport,
        url
      );

      sendResponse({
        action: 'MCP_TEST_RESULT',
        ok: true,
        serverId: request.serverId || null,
        transport,
        url,
        toolsCount: Array.isArray(tools) ? tools.length : 0,
      });
    } catch (e) {
      sendResponse({
        action: 'MCP_TEST_RESULT',
        ok: false,
        serverId: request.serverId || null,
        transport: request.transport || 'sse',
        url: request.url || '',
        error: e.message || String(e),
      });
    }
  }

  async listTools(request, sendResponse) {
    try {
      if (!this.mcpManager) throw new Error('MCP manager not available');
      const { transport, url } = buildMcpRequestConfig(request);
      if (!url) throw new Error('Server URL is empty');

      const tools = await this.mcpManager.listToolsForServer(
        request.serverId || 'mcp_list_tools',
        transport,
        url
      );

      sendResponse({
        action: 'MCP_TOOLS_RESULT',
        ok: true,
        serverId: request.serverId || null,
        transport,
        url,
        tools: mapToolsForUi(tools),
      });
    } catch (e) {
      sendResponse({
        action: 'MCP_TOOLS_RESULT',
        ok: false,
        serverId: request.serverId || null,
        transport: request.transport || 'sse',
        url: request.url || '',
        error: e.message || String(e),
        tools: [],
      });
    }
  }
}
