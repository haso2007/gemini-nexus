import { debugLog } from '../../shared/logging/debug.js';

/**
 * Manages the connection to the Chrome Debugger API.
 */
export class BrowserConnection {
    constructor() {
        this.currentTabId = null;
        this.targetTabId = null; // Tracks the intended tab ID even if debugger is not attached
        this.attached = false;
        this.onDetachCallbacks = [];
        this.eventListeners = new Set();
        this.currentDialog = null;
        this.lastAttachErrorMessage = '';
        this.lastDetachReason = '';
        this.isScriptingMode = false;

        // Detect debugger availability
        this.debuggerAvailable = Boolean(
            chrome.debugger && typeof chrome.debugger.attach === 'function'
        );
        this.scriptingAvailable = Boolean(chrome.scripting && chrome.scripting.executeScript);

        if (this.debuggerAvailable) {
            // Global listener for CDP events
            chrome.debugger.onEvent.addListener(this._handleEvent.bind(this));

            // Monitor external detachments
            chrome.debugger.onDetach.addListener(this._onDebuggerDetached.bind(this));
        }
    }

    _handleEvent(source, method, params) {
        if (this.attached && this.currentTabId === source.tabId) {
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
                } catch (error) {
                    debugLog('[BrowserConnection] Event listener failed:', error);
                }
            }
        }
    }

    _onDebuggerDetached(source, reason) {
        // If the browser detached our current session, clean up state immediately
        if (this.currentTabId === source.tabId) {
            debugLog('[BrowserConnection] Debugger detached by browser:', reason);
            this.lastDetachReason = reason || 'detached';
            this._cleanupState();
        }
    }

    _cleanupState() {
        this.attached = false;
        this.currentTabId = null;
        this.currentDialog = null;
        this.onDetachCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                debugLog('[BrowserConnection] Detach callback failed:', error);
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

    async _enableDomains() {
        await this.sendCommand('Runtime.enable');
        await this.sendCommand('Page.enable');
        try {
            await this.sendCommand('Target.setAutoAttach', {
                autoAttach: true,
                waitForDebuggerOnStart: false,
                flatten: true,
            });
        } catch (error) {
            debugLog('[BrowserConnection] Target auto-attach unavailable:', error);
        }
    }

    async attach(tabId) {
        this.targetTabId = tabId; // Always store the intended tab

        if (!this.debuggerAvailable) {
            if (!this.scriptingAvailable) {
                this.lastAttachErrorMessage =
                    'Browser control is not supported in this browser environment.';
                return false;
            }
            this.attached = true;
            this.currentTabId = tabId;
            this.isScriptingMode = true;
            this.lastAttachErrorMessage = '';
            this.lastDetachReason = '';
            return true;
        }

        // If already attached to the same tab, just ensure domains are enabled
        if (this.attached && this.currentTabId === tabId) {
            try {
                await this._enableDomains();
            } catch (error) {
                console.warn('Failed to refresh debugger domains:', error);
            }
            return true;
        }

        // If attached to a different tab, detach first
        if (this.attached && this.currentTabId !== tabId) {
            await this.detach();
        }

        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, '1.3', async () => {
                if (chrome.runtime.lastError) {
                    const attachErrorMessage = chrome.runtime.lastError.message;
                    this.lastAttachErrorMessage = attachErrorMessage;
                    // Suppress common expected errors for restricted targets to avoid log noise
                    if (
                        attachErrorMessage.includes('restricted URL') ||
                        attachErrorMessage.includes('Cannot access') ||
                        attachErrorMessage.includes('Attach to webui')
                    ) {
                        debugLog(
                            '[BrowserConnection] Attach skipped (restricted):',
                            attachErrorMessage
                        );
                    } else {
                        console.warn('[BrowserConnection] Attach failed:', attachErrorMessage);
                    }
                    // Resolve anyway to allow fallback actions (like navigation) to proceed without debugger
                    resolve(false);
                } else {
                    this.attached = true;
                    this.currentTabId = tabId;
                    this.lastAttachErrorMessage = '';
                    this.lastDetachReason = '';

                    try {
                        await this._enableDomains();
                    } catch (error) {
                        this.lastAttachErrorMessage = error?.message || String(error);
                        console.warn('Failed to enable collection domains:', error);
                        await this.detach();
                        resolve(false);
                        return;
                    }

                    resolve(true);
                }
            });
        });
    }

    async detach() {
        if (!this.attached || !this.currentTabId) return;
        if (this.isScriptingMode) {
            this._cleanupState();
            return;
        }
        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId: this.currentTabId }, () => {
                // IMPORTANT: Consume lastError to prevent "Unchecked runtime.lastError"
                // if the tab was already closed or detached externally.
                if (chrome.runtime.lastError) {
                    debugLog(
                        '[BrowserConnection] Detach ignored:',
                        chrome.runtime.lastError.message
                    );
                }

                this._cleanupState();
                resolve();
            });
        });
    }

    sendCommand(method, params = {}) {
        if (!this.attached || !this.currentTabId) throw new Error('No active debugger session');
        if (this.isScriptingMode) {
            return this._sendScriptingCommand(method, params);
        }
        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId: this.currentTabId }, method, params, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async _executeInPage(func, args = []) {
        const results = await chrome.scripting.executeScript({
            target: { tabId: this.currentTabId },
            func,
            args,
        });
        return results && results[0] ? results[0].result : null;
    }

    async _sendScriptingCommand(method, params) {
        switch (method) {
            case 'Runtime.enable':
            case 'Page.enable':
            case 'DOM.enable':
            case 'Accessibility.enable':
            case 'Overlay.enable':
            case 'Overlay.hideHighlight':
            case 'Target.setAutoAttach':
                return {};

            case 'Overlay.highlightNode':
                return {};

            case 'Runtime.evaluate':
                return await this._scriptingEvaluate(params);

            case 'Runtime.callFunctionOn':
                return await this._scriptingCallFunctionOn(params);

            case 'DOM.resolveNode':
                return { object: { objectId: `dom-${params.backendNodeId}` } };

            case 'Accessibility.getFullAXTree':
                return await this._scriptingGetFullAXTree();

            case 'Input.dispatchMouseEvent':
                return await this._scriptingDispatchMouseEvent(params);

            case 'Input.dispatchKeyEvent':
                return await this._scriptingDispatchKeyEvent(params);

            case 'Input.insertText':
                return await this._scriptingInsertText(params);

            case 'DOM.scrollIntoViewIfNeeded':
                return await this._scriptingScrollIntoView(params);

            case 'DOM.getBoxModel':
                return await this._scriptingGetBoxModel(params);

            case 'DOM.setFileInputFiles':
                return await this._scriptingSetFileInputFiles(params);

            case 'Page.handleJavaScriptDialog':
                return {};

            case 'Page.getFrameTree':
                return { frameTree: { frame: { id: 'main' } } };

            default:
                console.warn(`[BrowserConnection] Unhandled scripting command: ${method}`);
                return {};
        }
    }

    async _scriptingEvaluate(params) {
        const expression = params.expression || '';
        const result = await this._executeInPage(
            (expr) => {
                try {
                    const val = eval(expr);
                    if (val && typeof val.then === 'function') {
                        return val
                            .then((v) => ({ result: { type: 'object', value: v } }))
                            .catch((err) => ({
                                exceptionDetails: {
                                    text: err.message,
                                    exception: { description: String(err) },
                                },
                            }));
                    }
                    return { result: { type: typeof val, value: val } };
                } catch (err) {
                    return {
                        exceptionDetails: {
                            text: err.message,
                            exception: { description: String(err) },
                        },
                    };
                }
            },
            [expression]
        );
        return result;
    }

    async _scriptingCallFunctionOn(params) {
        const objectId = params.objectId;
        const funcDecl = params.functionDeclaration;
        const args = (params.arguments || []).map((arg) =>
            arg.value !== undefined ? arg.value : null
        );

        const result = await this._executeInPage(
            (oid, decl, callArgs) => {
                try {
                    const el = window.__geminiNexusDomNodes
                        ? window.__geminiNexusDomNodes.get(oid)
                        : null;
                    const fn = eval(`(${decl})`);
                    const val = fn.apply(el, callArgs);
                    if (val && typeof val.then === 'function') {
                        return val
                            .then((v) => ({ result: { type: 'object', value: v } }))
                            .catch((err) => ({
                                exceptionDetails: {
                                    text: err.message,
                                    exception: { description: String(err) },
                                },
                            }));
                    }
                    return { result: { type: typeof val, value: val } };
                } catch (err) {
                    return {
                        exceptionDetails: {
                            text: err.message,
                            exception: { description: String(err) },
                        },
                    };
                }
            },
            [objectId, funcDecl, args]
        );
        return result;
    }

    async _scriptingGetFullAXTree() {
        const nodes = await this._executeInPage(() => {
            if (!window.__geminiNexusDomNodes) {
                window.__geminiNexusDomNodes = new Map();
            }
            window.__geminiNexusDomNodes.clear();

            const axNodes = [];
            let nodeIdCounter = 1;

            function getRole(el) {
                const role = el.getAttribute('role');
                if (role) return role;
                const tag = el.tagName.toLowerCase();
                const map = {
                    a: 'link',
                    button: 'button',
                    input: 'textbox',
                    textarea: 'textbox',
                    select: 'combobox',
                    img: 'image',
                    h1: 'heading',
                    h2: 'heading',
                    h3: 'heading',
                    h4: 'heading',
                    h5: 'heading',
                    h6: 'heading',
                    ul: 'list',
                    ol: 'list',
                    li: 'listitem',
                    label: 'label',
                    table: 'table',
                    tr: 'row',
                    td: 'cell',
                    th: 'columnheader',
                };
                if (tag === 'input') {
                    const type = el.type.toLowerCase();
                    if (type === 'checkbox') return 'checkbox';
                    if (type === 'radio') return 'radio';
                    if (type === 'button' || type === 'submit') return 'button';
                }
                return map[tag] || 'generic';
            }

            function getName(el) {
                if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
                if (el.placeholder) return el.placeholder;
                if (el.tagName === 'IMG') return el.alt || '';
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';
                return el.innerText ? el.innerText.trim().slice(0, 100) : '';
            }

            function traverse(el, parentNodeId) {
                if (el.nodeType !== 1) return;
                const nodeId = nodeIdCounter++;
                const backendNodeId = nodeId;
                const objectId = `dom-${backendNodeId}`;
                window.__geminiNexusDomNodes.set(objectId, el);

                const role = getRole(el);
                const name = getName(el);
                const node = {
                    nodeId,
                    backendDOMNodeId: backendNodeId,
                    role: { value: role },
                    name: { value: name },
                    childIds: [],
                    properties: [],
                };

                if (el.disabled) node.properties.push({ name: 'disabled', value: { value: true } });
                if (document.activeElement === el)
                    node.properties.push({ name: 'focused', value: { value: true } });
                if (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    node.properties.push({ name: 'editable', value: { value: true } });
                }

                axNodes.push(node);
                if (parentNodeId) {
                    const parent = axNodes.find((n) => n.nodeId === parentNodeId);
                    if (parent) parent.childIds.push(nodeId);
                }

                for (const child of el.children) {
                    traverse(child, nodeId);
                }
            }

            const root = {
                nodeId: nodeIdCounter++,
                role: { value: 'RootWebArea' },
                name: { value: document.title },
                childIds: [],
            };
            axNodes.push(root);
            if (document.body) {
                traverse(document.body, root.nodeId);
            }
            return axNodes;
        });
        return { nodes };
    }

    async _scriptingDispatchMouseEvent(params) {
        const { type, x, y } = params;
        await this._executeInPage(
            (t, cx, cy) => {
                const el = document.elementFromPoint(cx, cy);
                if (!el) return;
                const eventMap = {
                    mouseMoved: 'mousemove',
                    mousePressed: 'mousedown',
                    mouseReleased: 'mouseup',
                };
                const eventType = eventMap[t] || 'click';
                el.dispatchEvent(
                    new MouseEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        clientX: cx,
                        clientY: cy,
                        view: window,
                    })
                );
                if (t === 'mouseReleased') {
                    el.dispatchEvent(
                        new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            clientX: cx,
                            clientY: cy,
                            view: window,
                        })
                    );
                }
            },
            [type, x, y]
        );
        return {};
    }

    async _scriptingDispatchKeyEvent(params) {
        const { type, key, code, text } = params;
        await this._executeInPage(
            (t, k, c, txt) => {
                const el = document.activeElement || document.body;
                const eventType = t === 'keyDown' ? 'keydown' : 'keyup';
                el.dispatchEvent(
                    new KeyboardEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        key: k,
                        code: c,
                    })
                );
                if (
                    t === 'keyDown' &&
                    txt &&
                    el.tagName !== 'INPUT' &&
                    el.tagName !== 'TEXTAREA' &&
                    !el.isContentEditable
                ) {
                    // Fallback
                }
            },
            [type, key, code, text]
        );
        return {};
    }

    async _scriptingInsertText(params) {
        const text = params.text || '';
        await this._executeInPage(
            (txt) => {
                const el = document.activeElement;
                if (!el) return;
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    const val = el.value;
                    el.value = val.slice(0, start) + txt + val.slice(end);
                    el.selectionStart = el.selectionEnd = start + txt.length;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (el.isContentEditable) {
                    document.execCommand('insertText', false, txt);
                }
            },
            [text]
        );
        return {};
    }

    async _scriptingScrollIntoView(params) {
        const objectId = params.objectId;
        await this._executeInPage(
            (oid) => {
                const el = window.__geminiNexusDomNodes
                    ? window.__geminiNexusDomNodes.get(oid)
                    : null;
                if (el && el.scrollIntoView) {
                    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                }
            },
            [objectId]
        );
        return {};
    }

    async _scriptingGetBoxModel(params) {
        const backendNodeId = params.backendNodeId;
        const objectId = `dom-${backendNodeId}`;
        const rect = await this._executeInPage(
            (oid) => {
                const el = window.__geminiNexusDomNodes
                    ? window.__geminiNexusDomNodes.get(oid)
                    : null;
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                    width: r.width,
                    height: r.height,
                };
            },
            [objectId]
        );
        if (!rect) throw new Error('No box model');
        return {
            model: {
                content: [
                    rect.left,
                    rect.top,
                    rect.right,
                    rect.top,
                    rect.right,
                    rect.bottom,
                    rect.left,
                    rect.bottom,
                ],
            },
        };
    }

    async _scriptingSetFileInputFiles(params) {
        // File input setting is restricted in content scripts for security.
        // We return an error or no-op.
        return {};
    }
}
