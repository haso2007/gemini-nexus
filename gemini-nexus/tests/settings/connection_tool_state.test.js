import { describe, expect, test } from 'vitest';
import {
  getCachedTools,
  getServerKey,
  getToolsUiState,
  setCachedTools,
} from '../../sandbox/ui/settings/sections/connection_tool_state.js';

describe('connection tool state helpers', () => {
  test('computes stable cache keys from transport and url', () => {
    expect(getServerKey({ transport: 'WS', url: ' ws://127.0.0.1:3006/mcp ' })).toBe('ws:ws://127.0.0.1:3006/mcp');
  });

  test('stores and retrieves cached tools by matching key', () => {
    const cache = new Map();
    const server = { id: 'srv_1', transport: 'sse', url: 'http://127.0.0.1:3006/sse' };

    setCachedTools(cache, 'srv_1', 'sse', 'http://127.0.0.1:3006/sse', [{ name: 'fetch' }]);

    expect(getCachedTools(cache, server)).toEqual([{ name: 'fetch' }]);
    expect(getCachedTools(cache, { ...server, url: 'http://other' })).toBe(null);
  });

  test('creates and reuses per-server ui state', () => {
    const stateMap = new Map();
    const first = getToolsUiState(stateMap, 'srv_1');
    const second = getToolsUiState(stateMap, 'srv_1');

    expect(first).toBe(second);
    expect(first.openGroups.has('(other)')).toBe(true);
  });
});
