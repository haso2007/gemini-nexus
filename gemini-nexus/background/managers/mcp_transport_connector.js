import {
  bumpIdleClose,
  clearPending,
  createConnectionState,
  disconnectState,
} from './mcp_connection_state.js';
import {
  DEFAULT_PROTOCOL_VERSIONS,
  asHttpUrl,
  asWsUrl,
  sleep,
} from './mcp_remote_helpers.js';
import { parseStreamableHttpResponse } from './mcp_transport_http.js';
import {
  handleRpcMessage,
  sendNotificationMessage,
  sendRpcMessage,
} from './mcp_transport_rpc.js';
import { readSseStream } from './mcp_transport_sse.js';
import { openMcpWebSocket } from './mcp_transport_ws.js';

export class McpTransportConnector {
  constructor({ clientName = 'gemini-nexus', clientVersion = '0.0.0' } = {}) {
    this.clientName = clientName;
    this.clientVersion = clientVersion;
    this.connections = new Map();
    this.nextId = 1;
  }

  disconnect(serverId) {
    if (serverId) {
      const conn = this.connections.get(serverId);
      if (conn) {
        disconnectState(conn);
        this.connections.delete(serverId);
      }
      return;
    }

    for (const [id, conn] of this.connections.entries()) {
      disconnectState(conn);
    }
    this.connections.clear();
  }

  sendNotification(conn, method, params) {
    if (conn.transport === 'ws') {
      if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) return;
      sendNotificationMessage((msg) => conn.ws.send(JSON.stringify(msg)), method, params);
      return;
    }

    if (conn.transport === 'sse') {
      if (!conn.ssePostUrl) return;
      sendNotificationMessage((msg) => {
        fetch(conn.ssePostUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        }).catch(() => {});
      }, method, params);
      return;
    }

    if (conn.transport === 'streamable-http') {
      if (!conn.httpPostUrl) return;
      sendNotificationMessage((msg) => {
        fetch(conn.httpPostUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        }).catch(() => {});
      }, method, params);
    }
  }

  async sendRpc(conn, method, params) {
    if (conn.transport === 'streamable-http') {
      return await this._sendRpcStreamableHttp(conn, method, params);
    }

    if (conn.transport === 'ws') {
      if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
        throw new Error('MCP WebSocket not connected');
      }
    } else if (conn.transport === 'sse') {
      if (!conn.ssePostUrl) {
        throw new Error('MCP SSE not connected');
      }
    } else {
      throw new Error('MCP transport not connected');
    }

    if (conn.transport === 'ws') {
      return sendRpcMessage(
        conn,
        () => this.nextId++,
        (msg) => conn.ws.send(JSON.stringify(msg)),
        method,
        params
      );
    }

    return sendRpcMessage(
      conn,
      () => this.nextId++,
      (msg) => {
        fetch(conn.ssePostUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        }).catch((err) => {
          const entry = conn.pending.get(msg.id);
          if (entry) {
            clearTimeout(entry.timeout);
            conn.pending.delete(msg.id);
            entry.reject(new Error(`MCP POST failed: ${err?.message || String(err)}`));
          }
        });
      },
      method,
      params
    );
  }

  async ensureConnectedForServer(serverId, transport, url) {
    const conn = this._getOrCreateConnection(serverId);
    const transportLower = (transport || 'sse').toLowerCase();

    if (transportLower === 'ws' || transportLower === 'websocket') {
      const wsUrl = asWsUrl(url);
      if (!wsUrl) throw new Error('Invalid MCP server URL');
      const key = `ws:${wsUrl}`;

      if (conn.ws && conn.ws.readyState === WebSocket.OPEN && conn.initialized && conn.configKey === key) {
        bumpIdleClose(conn, () => this.disconnect(serverId));
        return conn;
      }

      disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'ws';

      await openMcpWebSocket({
        conn,
        wsUrl,
        onRpcMessage: (msg) => handleRpcMessage(conn, msg),
        onClose: (err) => {
          clearPending(conn, err);
          conn.ws = null;
          conn.initialized = false;
          conn.configKey = null;
          conn.transport = null;
        },
      });

      await this._initializeHandshake(conn);
      bumpIdleClose(conn, () => this.disconnect(serverId));
      return conn;
    }

    if (transportLower === 'sse') {
      const sseUrlStr = asHttpUrl(url);
      if (!sseUrlStr) throw new Error('Invalid MCP SSE URL');
      const key = `sse:${sseUrlStr}`;

      if (conn.transport === 'sse' && conn.initialized && conn.configKey === key && conn.ssePostUrl) {
        bumpIdleClose(conn, () => this.disconnect(serverId));
        return conn;
      }

      disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'sse';

      await this._connectSse(conn, sseUrlStr);
      await this._initializeHandshake(conn);
      bumpIdleClose(conn, () => this.disconnect(serverId));
      return conn;
    }

    if (transportLower === 'streamable-http' || transportLower === 'streamablehttp') {
      const httpUrl = asHttpUrl(url);
      if (!httpUrl) throw new Error('Invalid Streamable HTTP URL');
      const key = `streamable-http:${httpUrl}`;

      if (conn.transport === 'streamable-http' && conn.initialized && conn.configKey === key && conn.httpPostUrl) {
        bumpIdleClose(conn, () => this.disconnect(serverId));
        return conn;
      }

      disconnectState(conn);
      conn.configKey = key;
      conn.transport = 'streamable-http';
      conn.httpPostUrl = httpUrl;

      await this._initializeHandshake(conn);
      bumpIdleClose(conn, () => this.disconnect(serverId));
      return conn;
    }

    throw new Error(`Unsupported MCP transport: ${transport}`);
  }

  _getOrCreateConnection(serverId) {
    if (!this.connections.has(serverId)) {
      this.connections.set(serverId, createConnectionState());
    }
    return this.connections.get(serverId);
  }

  async _sendRpcStreamableHttp(conn, method, params) {
    if (!conn.httpPostUrl) throw new Error('MCP Streamable HTTP not connected');

    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method, params: params || {} };
    const response = await fetch(conn.httpPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`MCP Streamable HTTP error (${response.status}): ${text || response.statusText}`);
    }

    return parseStreamableHttpResponse(text);
  }

  async _connectSse(conn, sseUrlStr) {
    const sseUrl = new URL(sseUrlStr);
    const abort = new AbortController();
    conn.sseAbort = abort;
    conn.ssePostUrl = null;

    const endpointPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP SSE endpoint handshake timeout')), 10000);
      conn._resolveSseEndpoint = (url) => {
        clearTimeout(timeout);
        resolve(url);
      };
    });

    const response = await fetch(sseUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: abort.signal,
    });

    if (!response.ok) throw new Error(`MCP SSE connect failed (${response.status}): ${response.statusText}`);
    if (!response.body) throw new Error('MCP SSE response has no body');

    conn.sseReaderTask = readSseStream(
      conn,
      response.body.getReader(),
      sseUrl,
      (msg) => handleRpcMessage(conn, msg)
    ).catch(() => {}).finally(() => {
      clearPending(conn, new Error('MCP SSE stream closed'));
      conn.initialized = false;
      conn.transport = null;
      conn.configKey = null;
      conn.sseAbort = null;
      conn.ssePostUrl = null;
    });
    conn.ssePostUrl = await endpointPromise;
  }

  async _initializeHandshake(conn) {
    let lastError = null;
    for (const protocolVersion of DEFAULT_PROTOCOL_VERSIONS) {
      try {
        await this.sendRpc(conn, 'initialize', {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: this.clientName, version: this.clientVersion },
        });

        this.sendNotification(conn, 'notifications/initialized', {});
        conn.initialized = true;
        return;
      } catch (e) {
        lastError = e;
        await sleep(150);
      }
    }
    throw lastError || new Error('Failed to initialize MCP connection');
  }
}
