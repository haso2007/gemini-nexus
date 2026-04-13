import { afterEach, describe, expect, test, vi } from 'vitest';

describe('toolbar template and dom modules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiToolbarIcons;
    delete window.GeminiToolbarStrings;
    delete window.GeminiToolbarStyles;
    delete window.GeminiToolbarTemplates;
    delete window.GeminiToolbarDOM;
    delete window.GeminiStyles;
    delete globalThis.chrome;
  });

  test('exports template dependencies without installing toolbar globals', async () => {
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      },
    };

    const { toolbarIcons } = await import('../../content/toolbar/icons.js');
    const { toolbarStrings } = await import('../../content/toolbar/i18n.js');
    const { toolbarStyles } = await import('../../content/toolbar/styles/index.js');
    const { toolbarTemplates } = await import('../../content/toolbar/templates.js');
    const { ToolbarDOM } = await import('../../content/toolbar/view/dom.js');

    expect(window.GeminiToolbarIcons).toBeUndefined();
    expect(window.GeminiToolbarStrings).toBeUndefined();
    expect(window.GeminiToolbarStyles).toBeUndefined();
    expect(toolbarStyles).toContain('.toolbar');
    expect(toolbarStyles).toContain('.result-area');
    expect(window.GeminiToolbarTemplates).toBeUndefined();
    expect(toolbarTemplates.mainStructure).toContain('id="toolbar"');
    expect(toolbarTemplates.mainStructure).toContain('chrome-extension://test/logo.png');
    expect(window.GeminiToolbarDOM).toBeUndefined();

    const dom = new ToolbarDOM();
    const { host, shadow } = dom.create();

    expect(host.id).toBe('gemini-nexus-toolbar-host');
    expect(document.documentElement.contains(host)).toBe(true);
    expect(shadow.getElementById('toolbar')).not.toBeNull();
    expect(shadow.querySelector('style')).not.toBeNull();
    expect(shadow.querySelectorAll('link')).toHaveLength(2);
  });
});
