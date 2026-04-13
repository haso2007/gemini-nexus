import { describe, expect, test } from 'vitest';
import {
  CONNECTION_STORAGE_KEYS,
  normalizeStoredConnectionSettings,
  readRequestConnectionSettings,
  serializeConnectionSettingsForStorage,
} from '../../lib/connection_settings.js';

describe('connection settings helpers', () => {
  test('normalizes stored provider and legacy mcp settings for the UI', () => {
    const normalized = normalizeStoredConnectionSettings({
      geminiUseOfficialApi: true,
      geminiApiKey: 'abc',
      geminiThinkingLevel: 'high',
      geminiMcpEnabled: true,
      geminiMcpTransport: 'ws',
      geminiMcpServerUrl: 'ws://127.0.0.1:3006/mcp',
    });

    expect(normalized.provider).toBe('official');
    expect(normalized.apiKey).toBe('abc');
    expect(normalized.thinkingLevel).toBe('high');
    expect(normalized.mcpEnabled).toBe(true);
    expect(normalized.mcpServers).toHaveLength(1);
    expect(normalized.mcpServers[0]).toEqual(
      expect.objectContaining({
        transport: 'ws',
        url: 'ws://127.0.0.1:3006/mcp',
      })
    );
  });

  test('serializes UI settings into storage values and legacy removals', () => {
    const result = serializeConnectionSettingsForStorage({
      provider: 'openai',
      apiKey: 'ignored-for-openai',
      thinkingLevel: 'low',
      openaiBaseUrl: 'https://example.com/v1',
      openaiApiKey: 'sk-test',
      openaiModel: 'gpt-4.1-mini, gpt-4.1',
      mcpEnabled: true,
      mcpTransport: 'sse',
      mcpServerUrl: 'http://127.0.0.1:3006/sse',
      mcpServers: [
        {
          id: 'srv_1',
          name: 'Primary',
          transport: 'sse',
          url: 'http://127.0.0.1:3006/sse',
          enabled: true,
          toolMode: 'all',
          enabledTools: [],
        },
      ],
      mcpActiveServerId: 'srv_1',
    });

    expect(result.values).toEqual({
      geminiProvider: 'openai',
      geminiApiKey: 'ignored-for-openai',
      geminiThinkingLevel: 'low',
      geminiOpenaiBaseUrl: 'https://example.com/v1',
      geminiOpenaiApiKey: 'sk-test',
      geminiOpenaiModel: 'gpt-4.1-mini, gpt-4.1',
      geminiMcpEnabled: true,
      geminiMcpServers: [
        expect.objectContaining({
          id: 'srv_1',
          transport: 'sse',
          url: 'http://127.0.0.1:3006/sse',
        }),
      ],
      geminiMcpActiveServerId: 'srv_1',
    });
    expect(result.remove).toEqual(['geminiMcpTransport', 'geminiMcpServerUrl']);
  });

  test('builds request settings from stored values', () => {
    const settings = readRequestConnectionSettings({
      geminiProvider: 'openai',
      geminiApiKey: 'abc',
      geminiThinkingLevel: 'medium',
      geminiOpenaiBaseUrl: 'https://example.com/v1',
      geminiOpenaiApiKey: 'sk-test',
      geminiOpenaiModel: 'gpt-4.1',
    });

    expect(settings).toEqual({
      provider: 'openai',
      apiKey: 'abc',
      thinkingLevel: 'medium',
      openaiBaseUrl: 'https://example.com/v1',
      openaiApiKey: 'sk-test',
      openaiModel: 'gpt-4.1',
    });
  });

  test('exposes the shared storage key list', () => {
    expect(CONNECTION_STORAGE_KEYS).toEqual([
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
  });
});
