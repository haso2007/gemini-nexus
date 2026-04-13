import { describe, expect, test } from 'vitest';
import { normalizeConnectionSettings, resolveProvider } from '../../lib/provider.js';

describe('provider helpers', () => {
  test('resolves provider from explicit provider first', () => {
    expect(resolveProvider({ provider: 'openai', useOfficialApi: true })).toBe('openai');
  });

  test('falls back to legacy official flag only when provider is missing', () => {
    expect(resolveProvider({ useOfficialApi: true })).toBe('official');
    expect(resolveProvider({ geminiUseOfficialApi: true })).toBe('official');
    expect(resolveProvider({})).toBe('web');
  });

  test('normalizes connection settings and removes legacy provider flags', () => {
    expect(normalizeConnectionSettings({ useOfficialApi: true, apiKey: 'x' })).toEqual({
      provider: 'official',
      apiKey: 'x',
    });
  });
});
