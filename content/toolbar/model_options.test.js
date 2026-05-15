import { beforeAll, describe, expect, it } from 'vitest';

describe('toolbar web model helper', () => {
    beforeAll(async () => {
        globalThis.window = {};
        await import('./model_options.js');
    });

    it('defaults image editing actions to the Web image-preview model', () => {
        expect(
            window.GeminiWebModels.resolveImagePromptModel({
                provider: 'web',
                mode: 'remove_bg',
                model: 'gemini-3-pro',
            })
        ).toBe('gemini-3-pro-image-preview-11-2025');
    });

    it('keeps non-generation image analysis on the selected model', () => {
        expect(
            window.GeminiWebModels.resolveImagePromptModel({
                provider: 'web',
                mode: 'ocr',
                model: 'gemini-3-pro',
            })
        ).toBe('gemini-3-pro');
    });
});
