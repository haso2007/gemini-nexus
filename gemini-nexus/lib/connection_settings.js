import {
  DEFAULT_MCP_URL,
  normalizeMcpConnection,
  serializeMcpConnection,
} from './mcp_servers.js';
import { normalizeConnectionSettings } from './provider.js';

export const CONNECTION_STORAGE_KEYS = Object.freeze([
  'geminiProvider',
  'geminiUseOfficialApi',
  'geminiApiKey',
  'geminiThinkingLevel',
  'geminiOpenaiBaseUrl',
  'geminiOpenaiApiKey',
  'geminiOpenaiModel',
  'geminiMcpEnabled',
  'geminiMcpTransport',
  'geminiMcpServerUrl',
  'geminiMcpServers',
  'geminiMcpActiveServerId',
]);

export const CONNECTION_STORAGE_REMOVE_KEYS = Object.freeze([
  'geminiMcpTransport',
  'geminiMcpServerUrl',
]);

function readStoredConnectionValues(stored = {}) {
  return {
    provider: stored.geminiProvider,
    geminiUseOfficialApi: stored.geminiUseOfficialApi === true,
    apiKey: stored.geminiApiKey || '',
    thinkingLevel: stored.geminiThinkingLevel || 'low',
    openaiBaseUrl: stored.geminiOpenaiBaseUrl || '',
    openaiApiKey: stored.geminiOpenaiApiKey || '',
    openaiModel: stored.geminiOpenaiModel || '',
    mcpEnabled: stored.geminiMcpEnabled === true,
    mcpTransport: stored.geminiMcpTransport || 'sse',
    mcpServerUrl: stored.geminiMcpServerUrl || DEFAULT_MCP_URL,
    mcpServers: Array.isArray(stored.geminiMcpServers) ? stored.geminiMcpServers : null,
    mcpActiveServerId: stored.geminiMcpActiveServerId || null,
  };
}

export function normalizeStoredConnectionSettings(stored = {}) {
  const values = readStoredConnectionValues(stored);
  return {
    ...normalizeConnectionSettings(values),
    ...normalizeMcpConnection(values),
  };
}

export function serializeConnectionSettingsForStorage(settings = {}) {
  const normalized = normalizeConnectionSettings(settings);
  const normalizedMcp = serializeMcpConnection(settings);

  return {
    values: {
      geminiProvider: normalized.provider,
      geminiApiKey: normalized.apiKey || '',
      geminiThinkingLevel: normalized.thinkingLevel || 'low',
      geminiOpenaiBaseUrl: normalized.openaiBaseUrl || '',
      geminiOpenaiApiKey: normalized.openaiApiKey || '',
      geminiOpenaiModel: normalized.openaiModel || '',
      geminiMcpEnabled: normalizedMcp.mcpEnabled === true,
      geminiMcpServers: normalizedMcp.mcpServers,
      geminiMcpActiveServerId: normalizedMcp.mcpActiveServerId || null,
    },
    remove: [...CONNECTION_STORAGE_REMOVE_KEYS],
  };
}

export function readRequestConnectionSettings(stored = {}) {
  const normalized = normalizeConnectionSettings({
    provider: stored.geminiProvider,
    geminiUseOfficialApi: stored.geminiUseOfficialApi === true,
  });

  return {
    provider: normalized.provider,
    apiKey: (stored.geminiApiKey || '').trim(),
    thinkingLevel: stored.geminiThinkingLevel || 'low',
    openaiBaseUrl: stored.geminiOpenaiBaseUrl,
    openaiApiKey: stored.geminiOpenaiApiKey,
    openaiModel: stored.geminiOpenaiModel,
  };
}
