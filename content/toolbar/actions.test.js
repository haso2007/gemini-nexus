import { beforeEach, describe, expect, it, vi } from 'vitest';

function installToolbarStrings() {
    window.GeminiToolbarStrings = {
        titles: {
            ocr: 'OCR',
            translate: 'Translate',
            analyze: 'Analyze',
            upscale: 'Upscale',
            expand: 'Expand',
            removeText: 'Remove text',
            removeBg: 'Remove background',
            removeWatermark: 'Remove watermark',
            snip: 'Snip',
            textTranslate: 'Text translate',
            summarize: 'Summarize',
            grammar: 'Grammar',
            explain: 'Explain',
        },
        prompts: {
            ocr: 'ocr prompt',
            imageTranslate: 'translate prompt',
            analyze: 'analyze prompt',
            upscale: 'upscale prompt',
            expand: 'expand prompt',
            removeText: 'remove text prompt',
            removeBg: 'remove background prompt',
            removeWatermark: 'remove watermark prompt',
            snipAnalyze: 'snip prompt',
            textTranslate: (selection) => `translate ${selection}`,
            summarize: (selection) => `summarize ${selection}`,
            grammar: (selection) => `grammar ${selection}`,
            explain: (selection) => `explain ${selection}`,
        },
        loading: {
            ocr: 'loading ocr',
            translate: 'loading translate',
            analyze: 'loading analyze',
            upscale: 'loading upscale',
            expand: 'loading expand',
            removeText: 'loading remove text',
            removeBg: 'loading remove background',
            removeWatermark: 'loading remove watermark',
            snip: 'loading snip',
            summarize: 'loading summarize',
            grammar: 'loading grammar',
            regenerate: 'loading regenerate',
        },
        inputs: {
            ocr: 'input ocr',
            translate: 'input translate',
            analyze: 'input analyze',
            upscale: 'input upscale',
            expand: 'input expand',
            removeText: 'input remove text',
            removeBg: 'input remove background',
            removeWatermark: 'input remove watermark',
            snip: 'input snip',
            textTranslate: 'input text translate',
            summarize: 'input summarize',
            grammar: 'input grammar',
            explain: 'input explain',
        },
    };
}

async function installToolbarActions() {
    await import('./actions.js');
}

describe('ToolbarActions', () => {
    beforeEach(async () => {
        vi.resetModules();
        globalThis.window = {};
        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn(),
            },
        };
        installToolbarStrings();
        window.GeminiWebModels = {
            resolveImagePromptModel: ({ provider, mode, model }) =>
                provider === 'web' && mode === 'remove_bg'
                    ? 'gemini-3-pro-image-preview-11-2025'
                    : model,
        };
        await installToolbarActions();
    });

    it('keeps Web image-generation retries on the resolved image model', async () => {
        const ui = {
            provider: 'web',
            showAskWindow: vi.fn(async () => {}),
            showLoading: vi.fn(),
            setInputValue: vi.fn(),
            getSelectedModel: vi.fn(() => 'gemini-3-pro'),
        };
        const actions = new window.GeminiToolbarActions(ui);

        await actions.handleImagePrompt(
            'data:image/png;base64,AAA',
            { x: 1, y: 2 },
            'remove_bg',
            'gemini-3-pro'
        );

        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(chrome.runtime.sendMessage.mock.lastCall[0]).toEqual(
            expect.objectContaining({
                action: 'QUICK_ASK_IMAGE',
                imageMode: 'remove_bg',
                model: 'gemini-3-pro-image-preview-11-2025',
            })
        );
        chrome.runtime.sendMessage.mockClear();

        actions.handleRetry();

        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(chrome.runtime.sendMessage.mock.lastCall[0]).toEqual(
            expect.objectContaining({
                action: 'QUICK_ASK_IMAGE',
                imageMode: 'remove_bg',
                model: 'gemini-3-pro-image-preview-11-2025',
            })
        );
    });
});
