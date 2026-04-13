// background/managers/mcp_remote_manager.js
//
// Facade that keeps the rest of the app stable while delegating
// transport and tool-catalog responsibilities to focused modules.

import { getEnabledMcpServers } from '../../lib/mcp_servers.js';
import { McpToolCatalog } from './mcp_tool_catalog.js';
import { McpTransportConnector } from './mcp_transport_connector.js';

export class McpRemoteManager {
  constructor({ clientName = 'gemini-nexus', clientVersion = '0.0.0' } = {}) {
    this.connector = new McpTransportConnector({ clientName, clientVersion });
    this.catalog = new McpToolCatalog(this.connector);
  }

  isEnabled(config) {
    return this.getEnabledServers(config).length > 0;
  }

  getEnabledServers(config) {
    if (!config || config.enableMcpTools !== true) return [];
    return getEnabledMcpServers(config);
  }

  disconnect(serverId) {
    this.connector.disconnect(serverId);
  }

  listToolsForServer(serverId, transport, url) {
    return this.catalog.listToolsForServer(serverId, transport, url);
  }

  listAllActiveTools(servers) {
    return this.catalog.listAllActiveTools(servers);
  }

  callToolById(toolId, args, servers) {
    return this.catalog.callToolById(toolId, args, servers);
  }

  buildToolsPreamble(config) {
    return this.catalog.buildToolsPreamble(this.getEnabledServers(config));
  }
}
