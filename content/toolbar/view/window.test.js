// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

function createElements() {
    const resultText = document.createElement('div');
    return {
        askWindow: document.createElement('div'),
        askInput: document.createElement('textarea'),
        contextPreview: document.createElement('div'),
        resultArea: document.createElement('div'),
        resultText,
        windowTitle: document.createElement('div'),
        windowFooter: document.createElement('div'),
        footerStop: document.createElement('div'),
        footerActions: document.createElement('div'),
        buttons: {
            copy: document.createElement('button'),
        },
    };
}

describe('WindowView', () => {
    beforeAll(async () => {
        window.GeminiViewUtils = {
            positionElement: vi.fn(),
        };
        window.GeminiToolbarIcons = { COPY: 'copy' };
        await import('./window.js');
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        delete globalThis.chrome;
        window.GeminiViewUtils.positionElement.mockClear();
    });

    it('renders arbitrary error HTML as text', () => {
        const elements = createElements();
        elements.askWindow.classList.add('visible');
        const view = new window.GeminiViewWindow(elements);

        view.showError('<img src=x onerror="alert(1)">Boom');

        expect(elements.resultText.querySelector('img')).toBeNull();
        expect(elements.resultText.textContent).toContain('<img src=x onerror="alert(1)">Boom');
    });

    it('renders loading messages as text', () => {
        const elements = createElements();
        elements.askWindow.classList.add('visible');
        const view = new window.GeminiViewWindow(elements);

        view.showLoading('<img src=x onerror="alert(1)">Loading');

        expect(elements.resultText.querySelector('img')).toBeNull();
        expect(elements.resultText.textContent).toContain('<img src=x onerror="alert(1)">Loading');
    });

    it('allows only Gemini login links in rich error text', () => {
        const elements = createElements();
        elements.askWindow.classList.add('visible');
        const view = new window.GeminiViewWindow(elements);

        view.showError(
            'Login at <a href="https://gemini.google.com/u/1/" onclick="alert(1)">Gemini</a> or <a href="https://evil.test/">evil</a>'
        );

        const links = [...elements.resultText.querySelectorAll('a')];
        expect(links).toHaveLength(1);
        expect(links[0].href).toBe('https://gemini.google.com/u/1/');
        expect(links[0].getAttribute('onclick')).toBeNull();
        expect(elements.resultText.textContent).toContain('evil');
    });

    it('restores the previously saved ask window size when showing', async () => {
        globalThis.chrome = {
            storage: {
                local: {
                    get: vi.fn(async () => ({
                        gemini_nexus_window_size: { w: 640, h: 520 },
                    })),
                },
            },
        };
        Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
        const elements = createElements();
        const view = new window.GeminiViewWindow(elements);

        await view.show({ right: 20, bottom: 20 }, 'context', 'Ask');

        expect(elements.askWindow.style.width).toBe('640px');
        expect(elements.askWindow.style.height).toBe('520px');
        expect(window.GeminiViewUtils.positionElement).toHaveBeenCalled();
        expect(elements.askWindow.classList.contains('visible')).toBe(true);
    });

    it('still shows the ask window when saved size storage is unavailable', async () => {
        const elements = createElements();
        const view = new window.GeminiViewWindow(elements);

        await expect(
            view.show({ right: 20, bottom: 20 }, 'context', 'Ask')
        ).resolves.toBeUndefined();

        expect(elements.askWindow.classList.contains('visible')).toBe(true);
    });
});
