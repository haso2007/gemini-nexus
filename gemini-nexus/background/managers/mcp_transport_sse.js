export function createSseDispatcher(conn, baseUrl, onRpcMessage) {
  return (type, payload) => {
    const trimmed = (payload || '').trim();
    if (!trimmed) return;

    if (type === 'endpoint') {
      let endpoint = trimmed;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && typeof parsed.endpoint === 'string') {
          endpoint = parsed.endpoint;
        }
      } catch {}

      try {
        const url = new URL(endpoint, baseUrl).toString();
        if (!conn.ssePostUrl) {
          conn.ssePostUrl = url;
          if (conn._resolveSseEndpoint) conn._resolveSseEndpoint(url);
        }
      } catch {}
      return;
    }

    if (type === 'message' || type === 'mcp' || type === 'data') {
      try {
        const msg = JSON.parse(trimmed);
        if (msg && typeof msg === 'object') {
          onRpcMessage(msg);
        }
      } catch {}
    }
  };
}

export async function readSseStream(conn, reader, baseUrl, onRpcMessage) {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let eventType = 'message';
  let dataLines = [];

  const dispatchEvent = createSseDispatcher(conn, baseUrl, onRpcMessage);
  const dispatch = () => {
    const data = dataLines.join('\n');
    const type = eventType || 'message';
    eventType = 'message';
    dataLines = [];
    dispatchEvent(type, data);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const trimmed = line.replace(/\r$/, '');

      if (trimmed === '') { dispatch(); continue; }
      if (trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('event:')) { eventType = trimmed.slice('event:'.length).trim() || 'message'; continue; }
      if (trimmed.startsWith('data:')) { dataLines.push(trimmed.slice('data:'.length).trimStart()); continue; }
    }
  }
}
