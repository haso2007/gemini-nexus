const PAGE_SCRIPT = 'background/control/dom_page_script.js';
const BRIDGE_SCRIPT = 'background/control/dom_bridge_script.js';

let nextRequestId = 1;

function isClosedPortError(message) {
    return /message port closed|the message channel closed/i.test(message || '');
}

/**
 * Firefox stand-in for BrowserConnection. The same CDP method names are
 * executed by an injected page script instead of chrome.debugger.
 */
export class DomConnection {
    constructor() {
        this.driver = 'dom';
        this.debuggerAvailable = false;
        this.currentTabId = null;
        this.targetTabId = null;
        this.attached = false;
        this.onDetachCallbacks = [];
        this.eventListeners = new Set();
        this.currentDialog = null;
        this.lastAttachErrorMessage = '';
        this.lastDetachReason = '';

        chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
            if (!this.attached || tabId !== this.currentTabId) return;
            if (changeInfo.status === 'loading') {
                this._emit('Page.frameStartedNavigating', {
                    frameId: 'gemini-nexus-root',
                    url: changeInfo.url || '',
                });
            }
            if (changeInfo.status === 'complete') {
                this._emit('Page.loadEventFired', {});
                this._emit('Page.frameStoppedLoading', { frameId: 'gemini-nexus-root' });
            }
        });

        chrome.tabs?.onRemoved?.addListener((tabId) => {
            if (tabId === this.currentTabId) {
                this.lastDetachReason = 'target_closed';
                this._cleanupState();
            }
        });
    }

    _emit(method, params) {
        if (method === 'Page.javascriptDialogOpening') {
            this.currentDialog = {
                type: params?.type || 'dialog',
                message: params?.message || '',
                defaultPrompt: params?.defaultPrompt || '',
            };
        } else if (method === 'Page.javascriptDialogClosed') {
            this.currentDialog = null;
        }
        for (const callback of Array.from(this.eventListeners)) {
            try {
                callback(method, params);
            } catch {
                // Listeners are best-effort, matching BrowserConnection.
            }
        }
    }

    _cleanupState() {
        this.attached = false;
        this.currentTabId = null;
        this.currentDialog = null;
        this.onDetachCallbacks.forEach((callback) => {
            try {
                callback();
            } catch {
                // Detach listeners must not break the connection reset.
            }
        });
    }

    addListener(callback) {
        this.eventListeners.add(callback);
    }

    removeListener(callback) {
        this.eventListeners.delete(callback);
    }

    onDetach(callback) {
        this.onDetachCallbacks.push(callback);
    }

    getDialog() {
        return this.currentDialog;
    }

    clearDialog() {
        this.currentDialog = null;
    }

    async attach(tabId) {
        this.targetTabId = tabId;
        if (!chrome.scripting?.executeScript) {
            this.lastAttachErrorMessage = 'Firefox scripting.executeScript is unavailable.';
            return false;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: [PAGE_SCRIPT],
                world: 'MAIN',
            });
            await chrome.scripting.executeScript({
                target: { tabId },
                files: [BRIDGE_SCRIPT],
            });
        } catch (error) {
            this.lastAttachErrorMessage = error?.message || String(error);
            return false;
        }

        this.attached = true;
        this.currentTabId = tabId;
        this.lastAttachErrorMessage = '';
        this.lastDetachReason = '';
        return true;
    }

    async detach() {
        if (!this.attached) return;
        this.lastDetachReason = 'detached';
        this._cleanupState();
    }

    sendCommand(method, params = {}) {
        if (!this.attached || !this.currentTabId) {
            return Promise.reject(new Error('No active browser control session'));
        }
        const tabId = this.currentTabId;
        const requestId = `dom-${nextRequestId++}`;
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(
                tabId,
                { type: 'GN_CONTROL_CMD', requestId, method, params },
                (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        if (isClosedPortError(lastError.message)) {
                            resolve({});
                            return;
                        }
                        reject(new Error(lastError.message));
                        return;
                    }
                    if (response?.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    for (const event of response?.events || []) {
                        this._emit(event.method, event.params);
                    }
                    resolve(response?.result);
                }
            );
        });
    }
}
