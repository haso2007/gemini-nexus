import { sendToBackground } from '../../../../lib/messaging.js';
import {
  addServerState,
  buildEnabledTools,
  removeActiveServerState,
  resolveTransportFieldState,
} from './connection_server_actions.js';

export function bindMcpEvents(section) {
  const {
    mcpServerSelect,
    mcpAddServer,
    mcpRemoveServer,
    mcpServerName,
    mcpTransport,
    mcpServerUrl,
    mcpServerEnabled,
    mcpTestConnection,
    mcpToolMode,
    mcpRefreshTools,
    mcpEnableAllTools,
    mcpDisableAllTools,
    mcpToolSearch,
  } = section.elements;

  if (mcpServerSelect) {
    mcpServerSelect.addEventListener('change', (event) => {
      section._saveCurrentServerEdits();
      section.mcpActiveServerId = event.target.value;
      section._loadActiveServerIntoForm();
      section._renderMcpServerOptions();
      section.setMcpTestStatus('');
    });
  }

  if (mcpAddServer) {
    mcpAddServer.addEventListener('click', () => {
      section._saveCurrentServerEdits();
      const nextState = addServerState(section.mcpServers, () => section._getDefaultServer());
      section.mcpServers = nextState.servers;
      section.mcpActiveServerId = nextState.activeServerId;
      section._renderMcpServerOptions();
      section._loadActiveServerIntoForm();
      section.setMcpTestStatus('');
    });
  }

  if (mcpRemoveServer) {
    mcpRemoveServer.addEventListener('click', () => {
      section._saveCurrentServerEdits();
      const id = section.mcpActiveServerId;
      if (!id) return;

      const nextState = removeActiveServerState(section.mcpServers, id, () => section._getDefaultServer());
      section.mcpServers = nextState.servers;
      section.mcpActiveServerId = nextState.activeServerId;
      section._renderMcpServerOptions();
      section._loadActiveServerIntoForm();
      section.setMcpTestStatus('');
    });
  }

  const onEdit = () => {
    section._saveCurrentServerEdits();
    section._renderMcpServerOptions();
  };

  if (mcpServerName) mcpServerName.addEventListener('input', onEdit);
  if (mcpServerUrl) mcpServerUrl.addEventListener('input', onEdit);

  if (mcpTransport) {
    mcpTransport.addEventListener('change', () => {
      const server = section._getActiveServer();
      const state = resolveTransportFieldState({
        server,
        nextTransport: mcpTransport.value || 'sse',
        currentUrl: mcpServerUrl ? (mcpServerUrl.value || '').trim() : '',
        getDefaultUrlForTransport: (transport) => section._getDefaultUrlForTransport(transport),
      });

      if (mcpServerUrl) {
        mcpServerUrl.placeholder = state.placeholder;
        mcpServerUrl.value = state.value;
      }

      onEdit();
    });
  }

  if (mcpServerEnabled) mcpServerEnabled.addEventListener('change', onEdit);

  if (mcpToolMode) {
    mcpToolMode.addEventListener('change', () => {
      section._saveCurrentServerEdits();
      section._renderToolsUI();
    });
  }

  if (mcpToolSearch) {
    mcpToolSearch.addEventListener('input', () => {
      section._renderToolsUI();
    });
  }

  if (mcpRefreshTools) {
    mcpRefreshTools.addEventListener('click', () => {
      section._saveCurrentServerEdits();
      const server = section._getActiveServer();
      if (!server) return;

      section.setMcpTestStatus('Fetching tools...');
      sendToBackground({
        action: 'MCP_LIST_TOOLS',
        serverId: server.id,
        transport: server.transport || 'sse',
        url: server.url || '',
      });
    });
  }

  if (mcpEnableAllTools) {
    mcpEnableAllTools.addEventListener('click', () => {
      const server = section._getActiveServer();
      if (!server) return;
      const cached = section._getCachedTools(server);
      if (!cached || cached.length === 0) return;
      server.toolMode = 'selected';
      server.enabledTools = buildEnabledTools(cached);
      section._loadActiveServerIntoForm();
      section._renderToolsUI();
    });
  }

  if (mcpDisableAllTools) {
    mcpDisableAllTools.addEventListener('click', () => {
      const server = section._getActiveServer();
      if (!server) return;
      server.toolMode = 'selected';
      server.enabledTools = [];
      section._loadActiveServerIntoForm();
      section._renderToolsUI();
    });
  }

  if (mcpTestConnection) {
    mcpTestConnection.addEventListener('click', () => {
      section._saveCurrentServerEdits();
      const server = section._getActiveServer();
      if (!server) return;

      section.setMcpTestStatus('Testing connection...');
      sendToBackground({
        action: 'MCP_TEST_CONNECTION',
        serverId: server.id,
        transport: server.transport || 'sse',
        url: server.url || '',
      });
    });
  }
}
