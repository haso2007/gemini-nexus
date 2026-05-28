import { respondWithUiTask } from './ui_async.js';

const GEMINI_IMAGE_PATTERN = /^https:\/\/lh3\.googleusercontent\.com\/(?:rd-)?gg(?:-dl)?\/.+=s.*/;

function isGeminiPageSender(sender) {
    try {
        return new URL(sender?.tab?.url || '').origin === 'https://gemini.google.com';
    } catch {
        return false;
    }
}

export function handleFetchImage(context, request, sender, sendResponse) {
    respondWithUiTask(
        sendResponse,
        async () => {
            const result = await context.imageHandler.fetchImage(request.url);
            chrome.runtime
                .sendMessage({
                    ...result,
                    tabId: context.getTargetSidePanelTabId(request, sender),
                })
                .catch(() => {});
        },
        { errorLabel: 'Fetch image error', errorResponse: { status: 'completed' } }
    );
}

export function handleFetchGeminiWatermarkImage(context, request, sender, sendResponse) {
    respondWithUiTask(
        sendResponse,
        async () => {
            if (!isGeminiPageSender(sender)) {
                return { status: 'error', error: 'Unsupported sender' };
            }

            if (!GEMINI_IMAGE_PATTERN.test(request.url || '')) {
                return { status: 'error', error: 'Unsupported image URL' };
            }

            const result = await context.imageHandler.fetchImage(request.url);
            return {
                status: result.error ? 'error' : 'completed',
                base64: result.base64 || null,
                type: result.type || null,
                error: result.error || null,
            };
        },
        { errorLabel: 'Fetch Gemini watermark image error' }
    );
}

export function handleFetchGeneratedImage(context, request, sender, sendResponse) {
    respondWithUiTask(
        sendResponse,
        async () => {
            const result = await context.imageHandler.fetchImage(request.url);

            context.sendToRequestSource(sender, {
                action: 'GENERATED_IMAGE_RESULT',
                tabId: context.getTargetSidePanelTabId(request, sender),
                reqId: request.reqId,
                base64: result.base64,
                error: result.error,
            });
        },
        {
            errorLabel: 'Fetch generated image error',
            errorResponse: { status: 'completed' },
            onError: (error) => {
                context.sendToRequestSource(sender, {
                    action: 'GENERATED_IMAGE_RESULT',
                    tabId: context.getTargetSidePanelTabId(request, sender),
                    reqId: request.reqId,
                    error: error.message || String(error),
                });
            },
        }
    );
}
