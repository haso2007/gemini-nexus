import { afterEach, describe, expect, test, vi } from 'vitest';

describe('toolbar controller support modules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiToolbarActions;
    delete window.GeminiImageDetector;
    delete window.GeminiStreamHandler;
    delete window.GeminiInputManager;
    delete window.GeminiToolbarDispatcher;
    delete window.GeminiImageCropper;
    delete window.GeminiSelectionObserver;
    delete window.GeminiToolbarStrings;
    delete globalThis.chrome;
  });

  test('exports controller support modules without installing toolbar globals', async () => {
    globalThis.chrome = {
      runtime: {
        onMessage: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
    };

    const { ToolbarActions } = await import('../../content/toolbar/actions.js');
    const { GeminiImageDetector } = await import('../../content/toolbar/image.js');
    const { GeminiStreamHandler } = await import('../../content/toolbar/stream.js');
    const { ToolbarDispatcher } = await import('../../content/toolbar/dispatch.js');
    const { InputManager } = await import('../../content/toolbar/utils/input.js');
    const { imageCropper } = await import('../../content/toolbar/crop.js');
    const { SelectionObserver } = await import('../../content/selection.js');

    expect(window.GeminiToolbarActions).toBeUndefined();
    expect(window.GeminiImageDetector).toBeUndefined();
    expect(window.GeminiStreamHandler).toBeUndefined();
    expect(window.GeminiToolbarDispatcher).toBeUndefined();
    expect(window.GeminiInputManager).toBeUndefined();
    expect(window.GeminiImageCropper).toBeUndefined();
    expect(window.GeminiSelectionObserver).toBeUndefined();
    expect(ToolbarActions).toBeTypeOf('function');
    expect(GeminiImageDetector).toBeTypeOf('function');
    expect(GeminiStreamHandler).toBeTypeOf('function');
    expect(ToolbarDispatcher).toBeTypeOf('function');
    expect(InputManager).toBeTypeOf('function');
    expect(typeof imageCropper.crop).toBe('function');
    expect(SelectionObserver).toBeTypeOf('function');
  });
});
