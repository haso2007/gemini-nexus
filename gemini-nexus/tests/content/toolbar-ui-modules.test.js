import { afterEach, describe, expect, test, vi } from 'vitest';

describe('toolbar ui module exports', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiDragController;
    delete window.GeminiToolbarEvents;
    delete window.GeminiUIGrammar;
    delete window.GeminiUIRenderer;
    delete window.GeminiToolbarUIActions;
    delete window.GeminiCodeCopyHandler;
    delete window.GeminiRendererBridge;
    delete window.GeminiToolbarUI;
    delete window.GeminiToolbarIcons;
    delete window.GeminiToolbarStrings;
    delete window.GeminiToolbarStyles;
    delete window.GeminiToolbarTemplates;
    delete window.GeminiToolbarDOM;
    delete window.GeminiToolbarView;
    delete window.GeminiViewUtils;
    delete window.GeminiViewWidget;
    delete window.GeminiViewWindow;
    delete window.GeminiStyles;
    delete globalThis.chrome;
    delete globalThis.ResizeObserver;
  });

  test('exports ui-layer classes without installing toolbar globals', async () => {
    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn(),
        },
      },
    };
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };

    const { DragController } = await import('../../content/toolbar/utils/drag.js');
    const { ToolbarEvents } = await import('../../content/toolbar/events.js');
    const { GeminiUIGrammar } = await import('../../content/toolbar/ui/grammar.js');
    const { UIRenderer } = await import('../../content/toolbar/ui/renderer.js');
    const { ToolbarUIActions } = await import('../../content/toolbar/ui/actions_delegate.js');
    const { CodeCopyHandler } = await import('../../content/toolbar/ui/code_copy.js');
    const { RendererBridge } = await import('../../content/toolbar/bridge.js');
    const { ToolbarUI } = await import('../../content/toolbar/ui/manager.js');

    expect(window.GeminiDragController).toBeUndefined();
    expect(window.GeminiToolbarEvents).toBeUndefined();
    expect(window.GeminiUIGrammar).toBeUndefined();
    expect(window.GeminiUIRenderer).toBeUndefined();
    expect(window.GeminiToolbarUIActions).toBeUndefined();
    expect(window.GeminiCodeCopyHandler).toBeUndefined();
    expect(window.GeminiRendererBridge).toBeUndefined();
    expect(window.GeminiToolbarUI).toBeUndefined();
    expect(DragController).toBeTypeOf('function');
    expect(ToolbarEvents).toBeTypeOf('function');
    expect(GeminiUIGrammar).toBeTypeOf('function');
    expect(UIRenderer).toBeTypeOf('function');
    expect(ToolbarUIActions).toBeTypeOf('function');
    expect(CodeCopyHandler).toBeTypeOf('function');
    expect(RendererBridge).toBeTypeOf('function');

    const ui = new ToolbarUI();
    expect(ui.domBuilder).toBeTruthy();
    expect(ui.isBuilt).toBe(false);
  });
});
