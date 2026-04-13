import { bindMcpEvents } from './connection_mcp_events.js';
import { bindProviderEvents } from './connection_provider_events.js';

export function bindConnectionEvents(section) {
  bindProviderEvents(section);
  bindMcpEvents(section);
}
