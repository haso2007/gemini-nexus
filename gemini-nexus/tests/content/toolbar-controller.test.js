import { afterEach, describe, expect, test, vi } from 'vitest';

describe('toolbar controller settings sync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.GeminiToolbarController;
    delete globalThis.chrome;
    delete globalThis.__lastToolbarUi;
  });

  test('honors legacy official flag when provider is missing', async () => {
    class ToolbarUIStub {
      constructor() {
        globalThis.__lastToolbarUi = this;
      }
      build() {}
      setCallbacks() {}
      updateModelList(settings, model) {
        this.settings = settings;
        this.model = model;
      }
    }

    class Noop {
      constructor() {}
      init() {}
      cancelHide() {}
      scheduleHide() {}
    }

    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            geminiModel: 'gemini-3-flash-preview',
            geminiUseOfficialApi: true,
            geminiOpenaiModel: '',
          }),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    };

    const { ToolbarController } = await import('../../content/toolbar/controller.js');
    expect(window.GeminiToolbarController).toBeUndefined();

    new ToolbarController({
      ToolbarUIClass: ToolbarUIStub,
      ToolbarActionsClass: Noop,
      ImageDetectorClass: Noop,
      StreamHandlerClass: Noop,
      InputManagerClass: Noop,
      ToolbarDispatcherClass: Noop,
      SelectionObserverClass: Noop,
    });
    await Promise.resolve();

    expect(globalThis.__lastToolbarUi.settings.provider).toBe('official');
    expect(globalThis.__lastToolbarUi.model).toBe('gemini-3-flash-preview');
  });
});
