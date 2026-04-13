import { afterEach, describe, expect, test, vi } from 'vitest';
import { initializeContentApp } from '../../content/bootstrap.js';

describe('content bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('wires dependencies and applies initial storage settings', () => {
    const shortcuts = { setController: vi.fn() };
    const router = { init: vi.fn() };
    const overlayInstance = {};
    const controllerInstance = {
      setSelectionEnabled: vi.fn(),
      setImageToolsEnabled: vi.fn(),
    };
    const Overlay = vi.fn(class {
      constructor() {
        return overlayInstance;
      }
    });
    const Controller = vi.fn(class {
      constructor() {
        return controllerInstance;
      }
    });
    const get = vi.fn((keys, cb) => cb({
      geminiTextSelectionEnabled: false,
      geminiImageToolsEnabled: true,
    }));
    const addListener = vi.fn();

    const result = initializeContentApp({
      shortcuts,
      router,
      Overlay,
      Controller,
      storage: {
        local: { get },
        onChanged: { addListener },
      },
      logger: { log: vi.fn() },
    });

    expect(Overlay).toHaveBeenCalledTimes(1);
    expect(Controller).toHaveBeenCalledTimes(1);
    expect(router.init).toHaveBeenCalledWith(controllerInstance, overlayInstance);
    expect(shortcuts.setController).toHaveBeenCalledWith(controllerInstance);
    expect(get).toHaveBeenCalledWith(
      ['geminiTextSelectionEnabled', 'geminiImageToolsEnabled'],
      expect.any(Function)
    );
    expect(controllerInstance.setSelectionEnabled).toHaveBeenCalledWith(false);
    expect(controllerInstance.setImageToolsEnabled).toHaveBeenCalledWith(true);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(result.floatingToolbar).toBe(controllerInstance);
    expect(result.selectionOverlay).toBe(overlayInstance);
  });

  test('updates toolbar settings when local storage changes', () => {
    const listeners = [];
    const controllerInstance = {
      setSelectionEnabled: vi.fn(),
      setImageToolsEnabled: vi.fn(),
    };

    initializeContentApp({
      shortcuts: { setController: vi.fn() },
      router: { init: vi.fn() },
      Overlay: vi.fn(class {
        constructor() {
          return {};
        }
      }),
      Controller: vi.fn(class {
        constructor() {
          return controllerInstance;
        }
      }),
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb({})),
        },
        onChanged: {
          addListener: vi.fn((listener) => listeners.push(listener)),
        },
      },
      logger: { log: vi.fn() },
    });

    listeners[0]({
      geminiTextSelectionEnabled: { newValue: true },
      geminiImageToolsEnabled: { newValue: false },
    }, 'local');

    expect(controllerInstance.setSelectionEnabled).toHaveBeenLastCalledWith(true);
    expect(controllerInstance.setImageToolsEnabled).toHaveBeenLastCalledWith(false);
  });

  test('ignores non-local storage updates', () => {
    const listeners = [];
    const controllerInstance = {
      setSelectionEnabled: vi.fn(),
      setImageToolsEnabled: vi.fn(),
    };

    initializeContentApp({
      shortcuts: { setController: vi.fn() },
      router: { init: vi.fn() },
      Overlay: vi.fn(class {
        constructor() {
          return {};
        }
      }),
      Controller: vi.fn(class {
        constructor() {
          return controllerInstance;
        }
      }),
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb({})),
        },
        onChanged: {
          addListener: vi.fn((listener) => listeners.push(listener)),
        },
      },
      logger: { log: vi.fn() },
    });

    listeners[0]({
      geminiTextSelectionEnabled: { newValue: false },
    }, 'sync');

    expect(controllerInstance.setSelectionEnabled).not.toHaveBeenCalledWith(false);
  });
});
