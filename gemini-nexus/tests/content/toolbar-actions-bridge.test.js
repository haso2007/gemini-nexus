import { afterEach, describe, expect, test, vi } from 'vitest';

describe('toolbar actions and bridge modules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiToolbarStrings;
    delete window.GeminiMessageSecurity;
    delete globalThis.chrome;
  });

  test('ToolbarActions uses imported toolbar strings instead of relying on window globals', async () => {
    const { toolbarStrings } = await import('../../content/toolbar/i18n.js');
    delete window.GeminiToolbarStrings;

    const { ToolbarActions } = await import('../../content/toolbar/actions.js');
    const actions = new ToolbarActions({});

    expect(actions.t).toBe(toolbarStrings);
  });

  test('RendererBridge can initialize without content-window security globals', async () => {
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      },
    };

    const { RendererBridge } = await import('../../content/toolbar/bridge.js');
    const host = document.createElement('div');

    const bridge = new RendererBridge(host);

    expect(bridge.bridgeToken).toEqual(expect.any(String));
    expect(host.querySelector('iframe')).not.toBeNull();
  });
});
