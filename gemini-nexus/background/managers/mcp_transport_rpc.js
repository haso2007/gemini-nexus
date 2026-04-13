export function handleRpcMessage(conn, msg) {
  if (msg && typeof msg === 'object' && msg.id !== undefined) {
    const entry = conn.pending.get(msg.id);
    if (entry) {
      clearTimeout(entry.timeout);
      conn.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error.message || 'MCP error'));
      else entry.resolve(msg.result);
    }
  }
}

export function sendNotificationMessage(send, method, params) {
  send({
    jsonrpc: '2.0',
    method,
    params: params || {},
  });
}

export function sendRpcMessage(conn, getNextId, send, method, params) {
  const id = getNextId();
  const msg = {
    jsonrpc: '2.0',
    id,
    method,
    params: params || {},
  };

  const pending = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      conn.pending.delete(id);
      reject(new Error(`MCP request timeout: ${method}`));
    }, 30000);

    conn.pending.set(id, { resolve, reject, timeout });
  });

  send(msg);
  return pending;
}
