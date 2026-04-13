import { afterEach, describe, expect, test, vi } from 'vitest';

describe('content module exports', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiNexusOverlay;
    delete window.GeminiMessageRouter;
    delete window.GeminiShortcuts;
    delete globalThis.chrome;
  });

  test('exports content bootstrap dependencies without installing content globals', async () => {
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn(),
        },
      },
      storage: {
        local: {
          get: vi.fn((keys, callback) => callback({})),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    };

    const addEventListener = vi.spyOn(document, 'addEventListener').mockImplementation(() => {});

    const { SelectionOverlay } = await import('../../content/overlay.js');
    const { MessageRouter, geminiMessageRouter } = await import('../../content/messages.js');
    const { ShortcutManager, geminiShortcuts } = await import('../../content/shortcuts.js');

    expect(window.GeminiNexusOverlay).toBeUndefined();
    expect(window.GeminiMessageRouter).toBeUndefined();
    expect(geminiMessageRouter).toBeInstanceOf(MessageRouter);
    expect(window.GeminiShortcuts).toBeUndefined();
    expect(geminiShortcuts).toBeInstanceOf(ShortcutManager);
    expect(SelectionOverlay).toBeTypeOf('function');
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });
});
