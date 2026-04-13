export function getServerKey(server) {
  const transport = (server.transport || 'sse').toLowerCase();
  const url = (server.url || '').trim();
  return `${transport}:${url}`;
}

export function getCachedTools(cache, server) {
  const entry = cache.get(server.id);
  if (!entry) return null;
  if (entry.key !== getServerKey(server)) return null;
  return Array.isArray(entry.tools) ? entry.tools : null;
}

export function setCachedTools(cache, serverId, transport, url, tools) {
  cache.set(serverId, {
    key: `${(transport || 'sse').toLowerCase()}:${(url || '').trim()}`,
    tools: Array.isArray(tools) ? tools : [],
  });
}

export function getToolsUiState(stateMap, serverId) {
  const key = serverId || 'default';
  const existing = stateMap.get(key);
  if (existing) return existing;

  const state = { openGroups: new Set(['(other)']) };
  stateMap.set(key, state);
  return state;
}
