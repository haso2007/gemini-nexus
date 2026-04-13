export function getActiveServer(servers, activeServerId) {
  if (!Array.isArray(servers) || servers.length === 0) return null;
  const match = activeServerId ? servers.find((server) => server.id === activeServerId) : null;
  return match || servers[0];
}

export function applyServerFormState(server, formState) {
  const previousKey = `${server.transport || 'sse'}:${(server.url || '').trim()}`;

  server.name = formState.name || '';
  server.transport = formState.transport || 'sse';
  server.url = (formState.url || '').trim();
  server.enabled = formState.enabled === true;
  server.toolMode = formState.toolMode === 'selected' ? 'selected' : 'all';

  const nextKey = `${server.transport || 'sse'}:${(server.url || '').trim()}`;
  return previousKey !== nextKey;
}

export function getServerFormState(server, getDefaultUrlForTransport) {
  return {
    id: server.id,
    name: server.name || '',
    transport: server.transport || 'sse',
    url: server.url || '',
    urlPlaceholder: getDefaultUrlForTransport(server.transport || 'sse'),
    enabled: server.enabled !== false,
    toolMode: server.toolMode === 'selected' ? 'selected' : 'all',
  };
}

export function buildServerOptions(servers) {
  return (servers || []).map((server) => {
    const name = (server.name || '').trim();
    const label = name || (server.url || 'MCP Server');
    const status = server.enabled === false ? '✗' : '✓';
    return {
      value: server.id,
      label: `${status} ${label}`,
    };
  });
}
