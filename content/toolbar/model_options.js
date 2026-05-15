(function () {
    const DEFAULT_WEB_MODEL = 'gemini-3-flash';
    const WEB_IMAGE_GENERATION_MODEL = 'gemini-3-pro-image-preview-11-2025';
    const IMAGE_GENERATION_MODES = new Set([
        'upscale',
        'expand',
        'remove_text',
        'remove_bg',
        'remove_watermark',
    ]);

    const WEB_MODEL_OPTIONS = [
        { val: 'gemini-3-flash', txt: 'Fast' },
        { val: 'gemini-3-flash-thinking', txt: 'Thinking' },
        { val: 'gemini-3-pro', txt: '3.1 Pro' },
        { val: 'gemini-3.1-flash-image-preview', txt: 'Image Fast' },
        { val: WEB_IMAGE_GENERATION_MODEL, txt: 'Image Pro' },
    ];

    function createOptions() {
        return WEB_MODEL_OPTIONS.map((option) => ({ ...option }));
    }

    function createOptionMarkup() {
        return WEB_MODEL_OPTIONS.map(
            (option) => `<option value="${option.val}">${option.txt}</option>`
        ).join('');
    }

    function resolveImagePromptModel({ provider = 'web', mode, model } = {}) {
        if (provider === 'web' && IMAGE_GENERATION_MODES.has(mode)) {
            return WEB_IMAGE_GENERATION_MODEL;
        }
        return model || DEFAULT_WEB_MODEL;
    }

    window.GeminiWebModels = {
        DEFAULT_WEB_MODEL,
        WEB_IMAGE_GENERATION_MODEL,
        createOptions,
        createOptionMarkup,
        resolveImagePromptModel,
    };
})();
