import { normalizeMcpToolResult, summarizeInputSchema } from './mcp_remote_helpers.js';

export class McpToolCatalog {
  constructor(connector) {
    this.connector = connector;
  }

  async listToolsForServer(serverId, transport, url) {
    const conn = await this.connector.ensureConnectedForServer(serverId, transport, url);

    const now = Date.now();
    if (conn.toolsCache && now - conn.toolsCacheAt < 5 * 60 * 1000) {
      return conn.toolsCache;
    }

    const result = await this.connector.sendRpc(conn, 'tools/list', {});
    const tools = result && Array.isArray(result.tools) ? result.tools : [];
    conn.toolsCache = tools;
    conn.toolsCacheAt = now;
    return tools;
  }

  async listAllActiveTools(servers) {
    if (!Array.isArray(servers) || servers.length === 0) return [];

    const activeServers = servers.filter((server) => server && server.enabled !== false && server.url && server.url.trim());
    if (activeServers.length === 0) return [];

    const results = await Promise.allSettled(
      activeServers.map(async (server) => {
        const tools = await this.listToolsForServer(server.id, server.transport, server.url);
        return tools.map((tool) => ({
          ...tool,
          _serverId: server.id,
          _serverName: server.name || server.url,
          _toolId: `${server.id}__${tool.name}`,
        }));
      })
    );

    const allTools = [];
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'fulfilled') {
        allTools.push(...result.value);
      } else {
        console.error('[MCP] Server', activeServers[index].id, 'failed:', result.reason);
      }
    }

    return allTools;
  }

  async callToolById(toolId, args, servers) {
    const separator = toolId.indexOf('__');
    if (separator === -1) {
      throw new Error(`Invalid tool ID format: ${toolId}`);
    }

    const serverId = toolId.slice(0, separator);
    const toolName = toolId.slice(separator + 2);
    const server = servers.find((item) => item.id === serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const conn = await this.connector.ensureConnectedForServer(serverId, server.transport, server.url);
    const result = await this.connector.sendRpc(conn, 'tools/call', {
      name: toolName,
      arguments: args || {},
    });

    return normalizeMcpToolResult(result);
  }

  async buildToolsPreamble(servers) {
    let allTools = await this.listAllActiveTools(servers);
    const serverMap = new Map(servers.map((server) => [server.id, server]));

    allTools = allTools.filter((tool) => {
      const server = serverMap.get(tool._serverId);
      if (!server) return false;
      if (server.toolMode === 'selected') {
        const enabled = Array.isArray(server.enabledTools) ? new Set(server.enabledTools) : new Set();
        return enabled.has(tool.name);
      }
      return true;
    });

    if (!allTools.length) return '';

    const lines = [];
    lines.push('[System: External MCP Tools Enabled]');
    lines.push('You may call external tools using the same JSON tool-call format:');
    lines.push('```json');
    lines.push('{ "tool": "tool_name", "args": { /* ... */ } }');
    lines.push('```');
    lines.push('');
    lines.push('External Tools:');

    for (const tool of allTools) {
      if (!tool || typeof tool.name !== 'string') continue;
      const description = typeof tool.description === 'string' ? tool.description.trim() : '';
      const schema = summarizeInputSchema(tool.inputSchema);
      const suffix = schema ? ` args: ${schema}` : '';
      const displayName = tool._toolId || tool.name;
      lines.push(`- ${displayName}${description ? `: ${description}` : ''}${suffix}`);
    }

    lines.push('');
    return lines.join('\n');
  }
}
