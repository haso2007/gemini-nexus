// sidepanel/core/frame.js

export class FrameManager {
    constructor() {
        this.iframe = document.getElementById('sandbox-frame');
        this.skeleton = document.getElementById('skeleton');
    }

    init() {
        // --- Optimization: Instant Load (Sync) ---
        // Use localStorage for Theme/Lang to avoid waiting for async chrome.storage
        const cachedTheme = localStorage.getItem('geminiTheme') || 'system';
        const cachedLang = localStorage.getItem('geminiLanguage') || 'system';

        // Set src immediately to start loading HTML
        this.iframe.src = `../sandbox/index.html?theme=${cachedTheme}&lang=${cachedLang}`;
    }

    reveal() {
        this.iframe.classList.add('loaded');
        if (this.skeleton) this.skeleton.classList.add('hidden');
    }

    postMessage(message) {
        if (this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage(message, this.getOrigin() || '*');
        }
    }

    getWindow() {
        return this.iframe.contentWindow;
    }

    getOrigin() {
        try {
            return new URL(this.iframe.src, window.location.href).origin;
        } catch {
            return window.location.origin;
        }
    }

    isWindow(sourceWindow) {
        return this.iframe.contentWindow && sourceWindow === this.iframe.contentWindow;
    }

    isOrigin(origin) {
        return origin === this.getOrigin();
    }
}
