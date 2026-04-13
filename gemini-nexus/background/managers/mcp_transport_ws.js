export async function openMcpWebSocket({
  conn,
  wsUrl,
  onRpcMessage,
  onClose,
  WebSocketImpl = WebSocket,
}) {
  await new Promise((resolve, reject) => {
    const ws = new WebSocketImpl(wsUrl);
    conn.ws = ws;
    let opened = false;

    const handleOpen = () => {
      opened = true;
      resolve();
    };
    const handleError = () => {
      if (!opened) reject(new Error(`Failed to connect to MCP WebSocket: ${wsUrl}`));
    };
    const handleClose = () => {
      const err = new Error(`MCP WebSocket closed: ${wsUrl}`);
      onClose(err, opened);
      if (!opened) reject(err);
    };
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && typeof msg === 'object') {
          onRpcMessage(msg);
        }
      } catch {}
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('error', handleError);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('message', handleMessage);
  });
}
