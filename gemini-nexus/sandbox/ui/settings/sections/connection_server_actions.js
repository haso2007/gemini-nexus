export function addServerState(servers, createServer) {
  const nextServer = createServer();
  return {
    servers: [...servers, nextServer],
    activeServerId: nextServer.id,
  };
}

export function removeActiveServerState(servers, activeServerId, createServer) {
  let nextServers = servers.filter((server) => server.id !== activeServerId);

  if (nextServers.length === 0) {
    const fallbackServer = createServer();
    fallbackServer.enabled = false;
    nextServers = [fallbackServer];
  }

  return {
    servers: nextServers,
    activeServerId: nextServers[0].id,
  };
}

export function resolveTransportFieldState({ server, nextTransport, currentUrl, getDefaultUrlForTransport }) {
  const previousTransport = server ? (server.transport || 'sse') : 'sse';
  const previousDefault = getDefaultUrlForTransport(previousTransport);
  const placeholder = getDefaultUrlForTransport(nextTransport);
  const value = (!currentUrl || currentUrl === previousDefault) ? placeholder : currentUrl;

  return { placeholder, value };
}

export function buildEnabledTools(tools) {
  return (tools || []).map((tool) => tool.name).filter(Boolean);
}
