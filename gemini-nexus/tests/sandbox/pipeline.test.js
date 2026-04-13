import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { transformMarkdown } from '../../sandbox/render/pipeline.js';

describe('transformMarkdown', () => {
  let originalMarked;

  beforeEach(() => {
    originalMarked = globalThis.marked;
  });

  afterEach(() => {
    globalThis.marked = originalMarked;
  });

  test('escapes raw html when marked is unavailable', () => {
    delete globalThis.marked;

    expect(transformMarkdown('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('sanitizes dangerous html after markdown rendering', () => {
    globalThis.marked = {
      parse: () => '<p>safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    };

    const html = transformMarkdown('ignored');

    expect(html).toContain('<p>safe</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });
});
