export function createConnectionState() {
  return {
    transport: null,
    ws: null,
    configKey: null,
    pending: new Map(),
    initialized: false,
    toolsCache: null,
    toolsCacheAt: 0,
    idleCloseTimer: null,
    sseAbort: null,
    ssePostUrl: null,
    sseReaderTask: null,
    httpPostUrl: null,
    _resolveSseEndpoint: null,
  };
}

export function clearPending(conn, error) {
  for (const [id, entry] of conn.pending.entries()) {
    clearTimeout(entry.timeout);
    entry.reject(error);
    conn.pending.delete(id);
  }
}

export function clearIdleTimer(conn) {
  if (conn.idleCloseTimer) {
    clearTimeout(conn.idleCloseTimer);
    conn.idleCloseTimer = null;
  }
}

export function bumpIdleClose(conn, onIdleClose, delayMs = 120000) {
  clearIdleTimer(conn);
  conn.idleCloseTimer = setTimeout(() => {
    onIdleClose();
  }, delayMs);
}

export function disconnectState(conn) {
  clearIdleTimer(conn);
  clearPending(conn, new Error('MCP connection closed'));
  conn.toolsCache = null;
  conn.toolsCacheAt = 0;
  conn.initialized = false;
  conn.configKey = null;
  conn.transport = null;

  if (conn.ws) {
    try { conn.ws.close(); } catch {}
  }
  conn.ws = null;

  if (conn.sseAbort) {
    try { conn.sseAbort.abort(); } catch {}
  }
  conn.sseAbort = null;
  conn.ssePostUrl = null;
  conn.sseReaderTask = null;
  conn.httpPostUrl = null;
}
