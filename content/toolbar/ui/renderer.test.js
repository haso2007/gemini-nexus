// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

async function createRendererHarness() {
    vi.resetModules();
    delete window.GeminiUIRenderer;
    await import('./renderer.js');

    const resultText = document.createElement('div');
    resultText.innerHTML = '<img data-req-id="req-1" class="generated-image loading">';
    const view = {
        elements: { resultText },
        showResult: vi.fn(),
    };

    return {
        renderer: new window.GeminiUIRenderer(view, null),
        imageElement: resultText.querySelector('img[data-req-id="req-1"]'),
    };
}

describe('toolbar generated image renderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete globalThis.GeminiNexusWatermarkRemover;
    });

    it('auto-cleans fetched generated images when the setting is enabled', async () => {
        const process = vi.fn((base64Image) =>
            Promise.resolve(base64Image.replace('raw-image', 'clean-image'))
        );
        globalThis.GeminiNexusWatermarkRemover = { process };
        const { renderer, imageElement } = await createRendererHarness();

        await renderer.handleGeneratedImageResult({
            reqId: 'req-1',
            base64: 'data:image/png;base64,raw-image',
        });

        expect(process).toHaveBeenCalledWith('data:image/png;base64,raw-image');
        expect(imageElement.src).toContain('data:image/png;base64,clean-image');
        expect(imageElement.classList.contains('loading')).toBe(false);
    });

    it('keeps generated image pixels untouched when the setting is disabled', async () => {
        const process = vi.fn((base64Image) =>
            Promise.resolve(base64Image.replace('raw-image', 'clean-image'))
        );
        globalThis.GeminiNexusWatermarkRemover = { process };
        const { renderer, imageElement } = await createRendererHarness();
        renderer.setGeneratedImageWatermarkRemovalEnabled(false);

        await renderer.handleGeneratedImageResult({
            reqId: 'req-1',
            base64: 'data:image/png;base64,raw-image',
        });

        expect(process).not.toHaveBeenCalled();
        expect(imageElement.src).toContain('data:image/png;base64,raw-image');
        expect(imageElement.classList.contains('loading')).toBe(false);
    });
});
