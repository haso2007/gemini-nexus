(function () {
    const MESSAGE_SOURCE = 'GeminiNexus';
    const WATERMARK_REMOVAL_MESSAGE_TYPE = 'GEMINI_NEXUS_WATERMARK_REMOVAL_ENABLED';
    const FETCH_GEMINI_IMAGE_REQUEST_TYPE = 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_REQUEST';
    const FETCH_GEMINI_IMAGE_RESPONSE_TYPE = 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_RESPONSE';
    const STORAGE_KEYS = [
        'geminiTextSelectionEnabled',
        'geminiTextSelectionBlacklist',
        'geminiCustomSelectionTools',
        'geminiImageToolsEnabled',
        'geminiGeneratedImageWatermarkRemovalEnabled',
    ];

    function isSelectionBlacklisted(blacklist) {
        return (
            window.GeminiSelectionBlacklist?.matchesLocation?.(window.location, blacklist) === true
        );
    }

    function applySelectionSetting(toolbar, selectionState) {
        toolbar?.setSelectionEnabled?.(
            selectionState.enabled && !isSelectionBlacklisted(selectionState.blacklist)
        );
    }

    function notifyGeneratedImageWatermarkRemoval(enabled) {
        window.postMessage(
            {
                source: MESSAGE_SOURCE,
                type: WATERMARK_REMOVAL_MESSAGE_TYPE,
                enabled: enabled !== false,
            },
            '*'
        );
    }

    async function handleGeminiImageFetchRequest(data) {
        const requestId = data.requestId;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'FETCH_GEMINI_WATERMARK_IMAGE',
                url: data.url,
            });

            window.postMessage(
                {
                    source: MESSAGE_SOURCE,
                    type: FETCH_GEMINI_IMAGE_RESPONSE_TYPE,
                    requestId,
                    base64: response?.base64 || null,
                    imageType: response?.type || null,
                    error: response?.error || null,
                },
                '*'
            );
        } catch (error) {
            window.postMessage(
                {
                    source: MESSAGE_SOURCE,
                    type: FETCH_GEMINI_IMAGE_RESPONSE_TYPE,
                    requestId,
                    error: error?.message || String(error),
                },
                '*'
            );
        }
    }

    function initGeminiPageBridge() {
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;

            const data = event.data || {};
            if (data.source !== MESSAGE_SOURCE || data.type !== FETCH_GEMINI_IMAGE_REQUEST_TYPE) {
                return;
            }

            handleGeminiImageFetchRequest(data);
        });
    }

    function applyToolbarSettings(toolbar, result) {
        const generatedImageWatermarkRemovalEnabled =
            result.geminiGeneratedImageWatermarkRemovalEnabled !== false;

        toolbar?.setImageToolsEnabled?.(result.geminiImageToolsEnabled !== false);
        toolbar?.setGeneratedImageWatermarkRemovalEnabled?.(generatedImageWatermarkRemovalEnabled);
        toolbar?.setCustomSelectionTools?.(
            Array.isArray(result.geminiCustomSelectionTools)
                ? result.geminiCustomSelectionTools
                : []
        );
        notifyGeneratedImageWatermarkRemoval(generatedImageWatermarkRemovalEnabled);
    }

    function getStorageReadError() {
        return chrome.runtime?.lastError?.message || null;
    }

    function init(toolbar) {
        if (!toolbar) return;

        const selectionState = {
            enabled: true,
            blacklist: '',
        };

        const applyCurrentSelectionState = () => {
            applySelectionSetting(toolbar, selectionState);
        };

        chrome.storage.local.get(STORAGE_KEYS, (result) => {
            const errorMessage = getStorageReadError();
            if (errorMessage) {
                console.warn('Failed to load content toolbar settings:', errorMessage);
                return;
            }

            const stored = result || {};
            selectionState.enabled = stored.geminiTextSelectionEnabled !== false;
            selectionState.blacklist = stored.geminiTextSelectionBlacklist || '';

            applyCurrentSelectionState();
            applyToolbarSettings(toolbar, stored);
        });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;

            let shouldApplySelection = false;

            if (changes.geminiTextSelectionEnabled) {
                selectionState.enabled = changes.geminiTextSelectionEnabled.newValue !== false;
                shouldApplySelection = true;
            }

            if (changes.geminiTextSelectionBlacklist) {
                selectionState.blacklist = changes.geminiTextSelectionBlacklist.newValue || '';
                shouldApplySelection = true;
            }

            if (shouldApplySelection) {
                applyCurrentSelectionState();
            }

            if (changes.geminiImageToolsEnabled) {
                toolbar?.setImageToolsEnabled?.(changes.geminiImageToolsEnabled.newValue !== false);
            }

            if (changes.geminiGeneratedImageWatermarkRemovalEnabled) {
                const enabled =
                    changes.geminiGeneratedImageWatermarkRemovalEnabled.newValue !== false;
                toolbar?.setGeneratedImageWatermarkRemovalEnabled?.(enabled);
                notifyGeneratedImageWatermarkRemoval(enabled);
            }

            if (changes.geminiCustomSelectionTools) {
                toolbar?.setCustomSelectionTools?.(
                    Array.isArray(changes.geminiCustomSelectionTools.newValue)
                        ? changes.geminiCustomSelectionTools.newValue
                        : []
                );
            }
        });
    }

    initGeminiPageBridge();

    window.GeminiContentSettingsSync = { init };
})();
