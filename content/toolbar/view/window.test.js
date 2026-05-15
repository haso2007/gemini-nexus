// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';

function createElements() {
    const resultText = document.createElement('div');
    return {
        askWindow: document.createElement('div'),
        resultText,
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
        window.GeminiViewUtils = {};
        window.GeminiToolbarIcons = { COPY: 'copy' };
        await import('./window.js');
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
});
