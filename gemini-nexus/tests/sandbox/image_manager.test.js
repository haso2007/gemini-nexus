import { describe, expect, test } from 'vitest';
import { extractHtmlImagePayloads } from '../../sandbox/core/image_manager.js';

describe('extractHtmlImagePayloads', () => {
  test('normalizes base64 and remote images from pasted html', () => {
    const items = extractHtmlImagePayloads(
      '<img src="data:image/png;base64,abc"><img src="https://example.com/a.png">'
    );

    expect(items).toEqual([
      {
        kind: 'file',
        base64: 'data:image/png;base64,abc',
        type: 'image/png',
        name: 'pasted_image.png',
      },
      {
        kind: 'url',
        url: 'https://example.com/a.png',
      },
    ]);
  });

  test('skips likely spacer images for drag-and-drop parsing', () => {
    const items = extractHtmlImagePayloads(
      '<img src="https://example.com/tiny.png" width="12" height="12"><img src="https://example.com/real.png" width="120" height="80">',
      { fileName: 'dragged_image.png', minWidth: 50, minHeight: 50 }
    );

    expect(items).toEqual([
      {
        kind: 'url',
        url: 'https://example.com/real.png',
      },
    ]);
  });

  test('normalizes relative and protocol-relative urls via DOM normalization', () => {
    const html =
      '<base href="https://example.com/page"><img src="/img.png"><img src="//cdn.example.com/x.png">';
    const items = extractHtmlImagePayloads(html);

    expect(items).toEqual([
      { kind: 'url', url: 'https://example.com/img.png' },
      { kind: 'url', url: 'https://cdn.example.com/x.png' },
    ]);
  });

  test('accepts uppercase-scheme urls normalized by the DOM', () => {
    const items = extractHtmlImagePayloads('<img src="HTTPS://example.com/UPPER.png">');

    expect(items).toEqual([{ kind: 'url', url: 'https://example.com/UPPER.png' }]);
  });
});
