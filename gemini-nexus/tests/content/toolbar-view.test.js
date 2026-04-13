import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function buildShadowDom() {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <div id="toolbar"></div>
    <div id="toolbar-drag"></div>
    <div id="image-btn"></div>
    <div id="ask-window"></div>
    <div id="ask-header"></div>
    <div id="window-title"></div>
    <div id="context-preview"></div>
    <input id="ask-input" />
    <div id="result-area"></div>
    <div id="result-text"></div>
    <select id="ask-model-select"><option value="gemini-3-flash">Fast</option></select>
    <div id="window-footer"></div>
    <div id="footer-actions"></div>
    <div id="footer-stop"></div>
    <button id="btn-copy"></button>
    <button id="btn-ask"></button>
    <button id="btn-grammar"></button>
    <button id="btn-translate"></button>
    <button id="btn-explain"></button>
    <button id="btn-summarize"></button>
    <button id="btn-header-close"></button>
    <button id="btn-stop-gen"></button>
    <button id="btn-continue-chat"></button>
    <button id="btn-copy-result"></button>
    <button id="btn-retry"></button>
    <button id="btn-insert"></button>
    <button id="btn-replace"></button>
    <button id="btn-image-chat"></button>
    <button id="btn-image-describe"></button>
    <button id="btn-image-extract"></button>
    <button id="btn-image-remove-bg"></button>
    <button id="btn-image-remove-text"></button>
    <button id="btn-image-remove-watermark"></button>
    <button id="btn-image-upscale"></button>
    <button id="btn-image-expand"></button>
  `;
  return shadow;
}

describe('ToolbarView', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiViewUtils;
    delete window.GeminiViewWidget;
    delete window.GeminiViewWindow;
    delete window.GeminiToolbarView;
    delete globalThis.chrome;
  });

  test('exports ToolbarView and updates model options', async () => {
    const { ToolbarView } = await import('../../content/toolbar/view/index.js');

    expect(window.GeminiToolbarView).toBeUndefined();

    const view = new ToolbarView(buildShadowDom());

    expect(view.getSelectedModel()).toBe('gemini-3-flash');

    view.updateModelOptions(
      [
        { val: 'gemini-3-pro', txt: '3 Pro' },
        { val: 'gemini-3-flash', txt: 'Fast' },
      ],
      'gemini-3-pro'
    );

    expect(view.getSelectedModel()).toBe('gemini-3-pro');
  });
});
