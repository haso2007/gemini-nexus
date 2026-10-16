(function () {
    if (globalThis.__geminiNexusPageFetch) return;
    globalThis.__geminiNexusPageFetch = true;

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'gemini-page-fetch') return;

        port.onMessage.addListener((message) => {
            if (!message || message.type !== 'start') return;
            const headers = { ...(message.headers || {}) };
            delete headers.Origin;
            delete headers.origin;
            delete headers.Referer;
            delete headers.referer;

            let body = message.body;
            if (message.bodyBytes) {
                body = new Uint8Array(message.bodyBytes);
            }

            fetch(message.url, {
                method: message.method || 'GET',
                headers,
                body: body ?? undefined,
                credentials: 'include',
            })
                .then(async (response) => {
                    const responseHeaders = {};
                    response.headers.forEach((value, key) => {
                        responseHeaders[key] = value;
                    });
                    if (response.body) {
                        const reader = response.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            port.postMessage({ type: 'chunk', bytes: Array.from(value) });
                        }
                    }
                    port.postMessage({
                        type: 'end',
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                    });
                })
                .catch((error) => {
                    port.postMessage({
                        type: 'error',
                        message: error?.message || String(error),
                    });
                });
        });
    });
})();
