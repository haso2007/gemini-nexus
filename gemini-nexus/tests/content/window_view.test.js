import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('WindowView', () => {
  beforeEach(async () => {
    vi.resetModules();
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    };
    const module = await import('../../content/toolbar/view/window.js');
    expect(window.GeminiViewWindow).toBeUndefined();
    expect(module.WindowView).toBeTypeOf('function');
  });

  afterEach(() => {
    delete window.GeminiViewWindow;
    delete globalThis.chrome;
  });

  test('renders error text without interpreting embedded html', async () => {
    const elements = {
      askWindow: document.createElement('div'),
      resultText: document.createElement('div'),
      windowFooter: document.createElement('div'),
      footerStop: document.createElement('div'),
      footerActions: document.createElement('div'),
      buttons: {
        copy: document.createElement('button'),
      },
    };
    const { WindowView } = await import('../../content/toolbar/view/window.js');
    const view = new WindowView(elements);

    view.showError('bad <img src=x onerror=alert(1)>');

    expect(elements.resultText.querySelector('img')).toBeNull();
    expect(elements.resultText.textContent).toContain('bad <img src=x onerror=alert(1)>');
  });

  test('renders trusted login recovery links without interpreting arbitrary html', async () => {
    const elements = {
      askWindow: document.createElement('div'),
      resultText: document.createElement('div'),
      windowFooter: document.createElement('div'),
      footerStop: document.createElement('div'),
      footerActions: document.createElement('div'),
      buttons: {
        copy: document.createElement('button'),
      },
    };
    const { WindowView } = await import('../../content/toolbar/view/window.js');
    const view = new WindowView(elements);

    view.showError('Account expired.', {
      linkText: 'Open Gemini login',
      linkUrl: 'https://gemini.google.com/u/0/',
    });

    const link = elements.resultText.querySelector('a');
    expect(link?.href).toBe('https://gemini.google.com/u/0/');
    expect(link?.textContent).toBe('Open Gemini login');
    expect(elements.resultText.querySelector('img')).toBeNull();
  });
});
