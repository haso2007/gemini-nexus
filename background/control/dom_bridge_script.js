(function () {
    if (globalThis.__geminiNexusDomBridge) return;
    globalThis.__geminiNexusDomBridge = true;

    function readPayload(data) {
        if (typeof data !== 'string') return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== 'GN_CONTROL_CMD') return;

        const requestId = message.requestId;
        const onResult = (event) => {
            if (event.source !== window) return;
            const payload = readPayload(event.data);
            if (!payload || payload.type !== 'GN_DOM_RESULT' || payload.requestId !== requestId) return;
            window.removeEventListener('message', onResult);
            if (payload.error) {
                sendResponse({ error: payload.error });
                return;
            }
            sendResponse({ result: payload.result, events: payload.events || [] });
        };

        window.addEventListener('message', onResult);
        window.postMessage(
            JSON.stringify({
                type: 'GN_DOM_CMD',
                requestId,
                method: message.method,
                params: message.params || {},
            }),
            '*'
        );
        return true;
    });
})();
