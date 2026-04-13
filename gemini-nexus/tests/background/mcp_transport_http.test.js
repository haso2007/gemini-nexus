import { describe, expect, test } from 'vitest';
import { parseStreamableHttpResponse } from '../../background/managers/mcp_transport_http.js';

describe('mcp streamable http helpers', () => {
  test('returns parsed result payloads', () => {
    expect(parseStreamableHttpResponse('{"result":{"ok":true}}')).toEqual({ ok: true });
  });

  test('unwraps embedded json from noisy responses', () => {
    expect(parseStreamableHttpResponse('noise {"result":{"ok":true}} trailing')).toEqual({ ok: true });
  });

  test('falls back to text content when response is not json', () => {
    expect(parseStreamableHttpResponse('plain text')).toEqual({
      content: [{ type: 'text', text: 'plain text' }],
    });
  });
});
