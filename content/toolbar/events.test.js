import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

async function installEvents() {
    await import('./events.js');
}

describe('ToolbarEvents', () => {
    let resizeObserverCallback;

    beforeEach(async () => {
        vi.resetModules();
        resizeObserverCallback = null;
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        globalThis.document = dom.window.document;
        globalThis.CustomEvent = dom.window.CustomEvent;
        globalThis.window = {};
        globalThis.ResizeObserver = class {
            constructor(callback) {
                resizeObserverCallback = callback;
            }
            observe() {}
            disconnect() {}
        };
        await installEvents();
    });

    it('binds the image translation menu item to the image_translate action', () => {
        const imageBtn = document.createElement('button');
        const imageTranslate = document.createElement('button');
        const askModelSelect = document.createElement('select');
        const askInput = document.createElement('input');
        const askWindow = document.createElement('div');
        const resultText = document.createElement('div');
        const triggerAction = vi.fn();

        const events = new window.GeminiToolbarEvents({
            actions: {
                triggerAction,
                cancelAsk: vi.fn(),
                stopAsk: vi.fn(),
            },
            handleImageClick: vi.fn(),
            handleImageHover: vi.fn(),
            handleModelChange: vi.fn(),
            isWindowVisible: vi.fn(() => false),
            isVisible: vi.fn(() => false),
            hide: vi.fn(),
            hideImageButton: vi.fn(),
            saveWindowDimensions: vi.fn(),
            codeCopy: {
                handle: vi.fn(),
            },
        });

        events.bind(
            {
                imageBtn,
                askInput,
                askModelSelect,
                askWindow,
                resultText,
                buttons: {
                    imageTranslate,
                },
            },
            askWindow
        );

        imageTranslate.click();

        expect(triggerAction).toHaveBeenCalledTimes(1);
        expect(triggerAction.mock.calls[0][1]).toBe('image_translate');
        events.disconnect();
    });

    it('saves the ask window dimensions after the visible window is resized', () => {
        const askModelSelect = document.createElement('select');
        const askInput = document.createElement('input');
        const askWindow = document.createElement('div');
        const resultText = document.createElement('div');
        const saveWindowDimensions = vi.fn();

        const events = new window.GeminiToolbarEvents({
            actions: {
                triggerAction: vi.fn(),
                cancelAsk: vi.fn(),
                stopAsk: vi.fn(),
            },
            handleImageClick: vi.fn(),
            handleImageHover: vi.fn(),
            handleModelChange: vi.fn(),
            isWindowVisible: vi.fn(() => true),
            isVisible: vi.fn(() => false),
            hide: vi.fn(),
            hideImageButton: vi.fn(),
            saveWindowDimensions,
            codeCopy: {
                handle: vi.fn(),
            },
        });

        events.bind(
            {
                askInput,
                askModelSelect,
                askWindow,
                resultText,
                buttons: {},
            },
            askWindow
        );

        resizeObserverCallback([
            {
                contentRect: {
                    width: 640,
                    height: 520,
                },
            },
        ]);

        expect(saveWindowDimensions).toHaveBeenCalledWith(640, 520);
        events.disconnect();
    });
});
