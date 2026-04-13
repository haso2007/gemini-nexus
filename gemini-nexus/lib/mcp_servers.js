export const DEFAULT_MCP_URL = 'http://127.0.0.1:3006/sse';

function makeServerId() {
  return `srv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createDefaultMcpServer(overrides = {}) {
  return {
    id: overrides.id ?? makeServerId(),
    name: overrides.name ?? 'Local Proxy',
    transport: overrides.transport || 'sse',
    url: overrides.url ?? DEFAULT_MCP_URL,
    enabled: overrides.enabled !== false,
    toolMode: overrides.toolMode === 'selected' ? 'selected' : 'all',
    enabledTools: Array.isArray(overrides.enabledTools) ? overrides.enabledTools : [],
  };
}

function normalizeServer(server = {}) {
  return createDefaultMcpServer({
    ...server,
    id: server.id || makeServerId(),
    name: server.name || '',
    transport: server.transport || 'sse',
    url: server.url || '',
    enabled: server.enabled !== false,
    toolMode: server.toolMode === 'selected' ? 'selected' : 'all',
    enabledTools: Array.isArray(server.enabledTools) ? server.enabledTools.filter(Boolean) : [],
  });
}

export function normalizeMcpConnection(config = {}, options = {}) {
  const { allowLegacy = true, includeDefault = false } = options;

  let servers = Array.isArray(config.mcpServers) && config.mcpServers.length > 0
    ? config.mcpServers.map(normalizeServer)
    : [];

  if (!servers.length && allowLegacy && (config.mcpServerUrl || config.mcpTransport)) {
    servers = [
      createDefaultMcpServer({
        transport: config.mcpTransport || 'sse',
        url: config.mcpServerUrl || DEFAULT_MCP_URL,
        enabled: config.mcpEnabled === true,
      }),
    ];
  }

  if (!servers.length && includeDefault) {
    servers = [
      createDefaultMcpServer({
        enabled: config.mcpEnabled === true,
      }),
    ];
  }

  const activeId = typeof config.mcpActiveServerId === 'string' && servers.some((server) => server.id === config.mcpActiveServerId)
    ? config.mcpActiveServerId
    : (servers[0]?.id || null);

  return {
    mcpEnabled: config.mcpEnabled === true,
    mcpServers: servers,
    mcpActiveServerId: activeId,
  };
}

export function serializeMcpConnection(config = {}) {
  const normalized = normalizeMcpConnection(config);
  return {
    mcpEnabled: normalized.mcpEnabled,
    mcpServers: normalized.mcpServers,
    mcpActiveServerId: normalized.mcpActiveServerId,
  };
}

export function getEnabledMcpServers(config = {}, options = {}) {
  return normalizeMcpConnection(config, options).mcpServers.filter(
    (server) => server.enabled !== false && server.url && server.url.trim()
  );
}
