const GEMINI_TAB_URLS = ['https://gemini.google.com/*', 'https://business.gemini.google.com/*'];

export function isFirefoxShim() {
    try {
        return globalThis.chrome?.__geminiNexusFirefoxShim === true;
    } catch {
        return false;
    }
}

export function shouldRetryGeminiFetchOnPage(status) {
    return status === 401 || status === 403 || status === 0;
}

function mergeChunks(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged;
}

export async function fetchGeminiWithPageFallback(url, init = {}) {
    const response = await fetch(url, init);
    if (response.ok || !isFirefoxShim() || !shouldRetryGeminiFetchOnPage(response.status)) {
        return response;
    }
    return fetchOnGeminiPage({
        url,
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: init.signal,
    });
}

export async function fetchOnGeminiPage({ url, method = 'GET', headers = {}, body = null, signal }) {
    const tabs = await chrome.tabs.query({ url: GEMINI_TAB_URLS });
    const tab = tabs.find((item) => Number.isInteger(item.id));
    if (!tab) {
        throw new Error(
            'Firefox blocked background cookies for Gemini. Open https://gemini.google.com, sign in, and retry.'
        );
    }

    let bodyBytes = null;
    let bodyText = null;
    if (body instanceof Uint8Array) {
        bodyBytes = Array.from(body);
    } else if (body instanceof ArrayBuffer) {
        bodyBytes = Array.from(new Uint8Array(body));
    } else if (typeof Blob !== 'undefined' && body instanceof Blob) {
        bodyBytes = Array.from(new Uint8Array(await body.arrayBuffer()));
    } else if (body != null) {
        bodyText = String(body);
    }

    const port = chrome.tabs.connect(tab.id, { name: 'gemini-page-fetch' });
    const chunks = [];

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            try {
                port.disconnect();
            } catch {
                // The port may already be closed after the page navigates.
            }
            fn(value);
        };
        const onAbort = () => finish(reject, new Error('Gemini page fetch aborted'));
        const timer = setTimeout(() => finish(reject, new Error('Gemini page fetch timed out')), 120000);
        signal?.addEventListener('abort', onAbort, { once: true });

        port.onMessage.addListener((message) => {
            if (message?.type === 'chunk' && Array.isArray(message.bytes)) {
                chunks.push(new Uint8Array(message.bytes));
                return;
            }
            if (message?.type === 'error') {
                finish(reject, new Error(message.message || 'Gemini page fetch failed'));
                return;
            }
            if (message?.type !== 'end') return;

            const bytes = mergeChunks(chunks);
            const headers = message.headers || {};
            finish(resolve, {
                ok: message.ok === true,
                status: message.status || 0,
                statusText: message.statusText || '',
                headers: {
                    get(name) {
                        const target = String(name).toLowerCase();
                        const found = Object.keys(headers).find((key) => key.toLowerCase() === target);
                        return found ? headers[found] : null;
                    },
                },
                async text() {
                    return new TextDecoder().decode(bytes);
                },
                body: {
                    getReader() {
                        let sent = false;
                        return {
                            async read() {
                                if (sent) return { done: true, value: undefined };
                                sent = true;
                                if (bytes.length === 0) return { done: true, value: undefined };
                                return { done: false, value: bytes };
                            },
                        };
                    },
                },
            });
        });

        port.onDisconnect.addListener(() => {
            const reason = chrome.runtime.lastError?.message || 'Gemini page fetch disconnected';
            finish(reject, new Error(reason));
        });

        port.postMessage({
            type: 'start',
            url,
            method,
            headers,
            body: bodyText,
            bodyBytes,
        });
    });
}
