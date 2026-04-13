import { describe, expect, test } from 'vitest';
import {
  asHttpUrl,
  asWsUrl,
  normalizeMcpToolResult,
  summarizeInputSchema,
} from '../../background/managers/mcp_remote_helpers.js';

describe('mcp remote helpers', () => {
  test('converts http urls to websocket urls', () => {
    expect(asWsUrl('http://127.0.0.1:3006/mcp')).toBe('ws://127.0.0.1:3006/mcp');
    expect(asWsUrl('https://example.com/mcp')).toBe('wss://example.com/mcp');
    expect(asHttpUrl('ws://127.0.0.1:3006/mcp')).toBe('ws://127.0.0.1:3006/mcp');
  });

  test('normalizes text and image tool results', () => {
    const result = normalizeMcpToolResult({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'image', mimeType: 'image/png', data: 'abc' },
      ],
    });

    expect(result.text).toBe('hello');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].base64).toBe('data:image/png;base64,abc');
  });

  test('summarizes required fields from input schema', () => {
    expect(
      summarizeInputSchema({
        properties: {
          url: { type: 'string' },
          wait: { type: 'number' },
        },
        required: ['url', 'wait'],
      })
    ).toBe('{ url: string, wait: number }');
  });
});
