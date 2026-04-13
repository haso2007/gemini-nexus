import { describe, expect, test } from 'vitest';
import { escapeAttribute, escapeHtml, sanitizeHtml } from '../../sandbox/render/sanitize.js';

describe('sandbox HTML sanitization', () => {
  test('strips dangerous tags and attributes from rendered html', () => {
    const html = sanitizeHtml('<p>Hello</p><script>alert(1)</script><img src="https://example.com/x.png" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(2)">Click</a>');

    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('<img src="https://example.com/x.png">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('javascript:');
  });

  test('preserves safe structural markup used by code blocks', () => {
    const html = sanitizeHtml('<div class="code-block-wrapper"><button class="copy-code-btn" aria-label="Copy"><svg viewBox="0 0 24 24"><path d="M0 0"></path></svg></button><pre><code class="hljs language-js">const x = 1;</code></pre></div>');

    expect(html).toContain('code-block-wrapper');
    expect(html).toContain('copy-code-btn');
    expect(html).toContain('<svg');
    expect(html).toContain('language-js');
  });

  test('preserves svg viewBox attributes during sanitization', () => {
    const html = sanitizeHtml('<svg viewBox="0 0 24 24"><path d="M0 0"></path></svg>');

    expect(html).toContain('viewBox="0 0 24 24"');
  });

  test('rejects data urls for anchor href but keeps them for image src', () => {
    const html = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">bad</a><img src="data:image/png;base64,abc" alt="ok">');

    expect(html).toContain('<a>bad</a>');
    expect(html).toContain('<img src="data:image/png;base64,abc" alt="ok">');
    expect(html).not.toContain('data:text/html');
  });

  test('escapes raw text and attribute values', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeAttribute('x" onerror="alert(1)')).toBe('x&quot; onerror=&quot;alert(1)');
  });
});
