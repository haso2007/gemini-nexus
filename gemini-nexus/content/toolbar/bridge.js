import {
    createBridgeToken,
    getOriginFromUrl,
    isTrustedBridgeResponse,
} from '../../lib/message_security.js';

export class RendererBridge {
    constructor(hostElement) {
        this.host = hostElement;
        this.iframe = null;
        this.requests = {};
        this.reqId = 0;
        this.bridgeToken = createBridgeToken();
        this.iframeOrigin = '';
        this.readyPromise = null;
        this.init();
    }

    init() {
        this.readyPromise = new Promise((resolve) => {
            let ready = false;
            const markReady = () => {
                if (ready) return;
                ready = true;
                if (this.iframe && this.iframe.contentWindow) {
                    this.iframe.contentWindow.postMessage({
                        action: 'INIT_BRIDGE',
                        bridgeToken: this.bridgeToken
                    }, this.iframeOrigin || '*');
                }
                resolve();
            };

            this.iframe = document.createElement('iframe');
            this.iframe.src = chrome.runtime.getURL('sandbox/index.html?mode=renderer');
            this.iframe.style.display = 'none';
            this.iframeOrigin = getOriginFromUrl(this.iframe.src);
            this.iframe.addEventListener('load', markReady, { once: true });

            this.host.appendChild(this.iframe);
            setTimeout(markReady, 1000);
        });

        window.addEventListener('message', (e) => {
            if (!isTrustedBridgeResponse(e, this.iframe.contentWindow, this.iframeOrigin, this.bridgeToken)) {
                return;
            }

            if (e.data.action === 'RENDER_RESULT') {
                const { html, reqId, fetchTasks } = e.data;
                if (this.requests[reqId]) {
                    this.requests[reqId]({ html, fetchTasks });
                    delete this.requests[reqId];
                }
            }

            if (e.data.action === 'PROCESS_IMAGE_RESULT') {
                const { base64, reqId } = e.data;
                if (this.requests[reqId]) {
                    this.requests[reqId](base64);
                    delete this.requests[reqId];
                }
            }
        });
    }

    async render(text, images = []) {
        const id = this.reqId++;
        return new Promise((resolve) => {
            this.requests[id] = resolve;
            this.readyPromise.then(() => {
                if (this.iframe.contentWindow) {
                    this.iframe.contentWindow.postMessage(
                        { action: 'RENDER', text, images, reqId: id, bridgeToken: this.bridgeToken },
                        this.iframeOrigin || '*'
                    );
                } else {
                    resolve({ html: text, fetchTasks: [] });
                }
            });
        });
    }

    async processImage(base64) {
        const id = this.reqId++;
        return new Promise((resolve) => {
            this.requests[id] = resolve;
            this.readyPromise.then(() => {
                if (this.iframe.contentWindow) {
                    this.iframe.contentWindow.postMessage(
                        { action: 'PROCESS_IMAGE', base64, reqId: id, bridgeToken: this.bridgeToken },
                        this.iframeOrigin || '*'
                    );
                } else {
                    resolve(base64);
                }
            });
        });
    }
}
