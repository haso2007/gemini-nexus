(function () {
    if (globalThis.__geminiNexusDomPage) return;

    const INTERACTIVE_ROLES = new Set([
        'button',
        'link',
        'textbox',
        'searchbox',
        'combobox',
        'checkbox',
        'radio',
        'switch',
        'slider',
        'tab',
        'menuitem',
        'option',
        'listbox',
    ]);

    const agent = {
        nextId: 1,
        pendingDialog: null,
        highlightTimer: null,
    };

    function ax(value) {
        return { type: typeof value, value };
    }

    function elementByBackendId(backendId) {
        const id = String(backendId);
        const escape =
            globalThis.CSS && typeof CSS.escape === 'function'
                ? CSS.escape
                : (value) => String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
        return document.querySelector(`[data-gn-backend="${escape(id)}"]`);
    }

    function ensureBackendId(element) {
        const existing = element.getAttribute('data-gn-backend');
        if (existing) return Number(existing);
        const id = agent.nextId++;
        element.setAttribute('data-gn-backend', String(id));
        return id;
    }

    function roleFor(element) {
        const explicit = element.getAttribute('role');
        if (explicit) return explicit;
        const tag = element.tagName;
        if (tag === 'A') return 'link';
        if (tag === 'BUTTON') return 'button';
        if (tag === 'TEXTAREA') return 'textbox';
        if (tag === 'SELECT') return 'combobox';
        if (tag === 'IMG') return 'image';
        if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') return 'heading';
        if (tag === 'INPUT') {
            const type = (element.getAttribute('type') || 'text').toLowerCase();
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (type === 'search') return 'searchbox';
            if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
            if (type === 'range') return 'slider';
            return 'textbox';
        }
        return 'generic';
    }

    function nameFor(element) {
        return (
            element.getAttribute('aria-label') ||
            element.getAttribute('alt') ||
            element.getAttribute('placeholder') ||
            element.getAttribute('title') ||
            (element.innerText || element.textContent || '').trim().slice(0, 120)
        );
    }

    function isVisible(element) {
        if (!element || element.nodeType !== 1) return false;
        const style = globalThis.getComputedStyle ? getComputedStyle(element) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return true;
    }

    function propertiesFor(element, role) {
        const properties = [];
        const disabled = element.matches?.(':disabled') || element.getAttribute('aria-disabled') === 'true';
        if (disabled) properties.push({ name: 'disabled', value: ax(true) });
        if (element === document.activeElement || INTERACTIVE_ROLES.has(role)) {
            properties.push({ name: 'focused', value: ax(element === document.activeElement) });
        }
        if (role === 'textbox' || role === 'searchbox' || element.isContentEditable) {
            properties.push({ name: 'editable', value: ax(true) });
        }
        if (element.required || element.getAttribute('aria-required') === 'true') {
            properties.push({ name: 'required', value: ax(true) });
        }
        if (role === 'checkbox' || role === 'radio' || role === 'switch') {
            properties.push({ name: 'checked', value: ax(Boolean(element.checked)) });
        }
        return properties;
    }

    function buildSnapshot() {
        const nodes = [];
        const rootId = 0;
        const root = {
            nodeId: rootId,
            childIds: [],
            role: ax('RootWebArea'),
            name: ax(document.title || ''),
            backendDOMNodeId: rootId,
        };
        nodes.push(root);

        const stack = [{ element: document.body, parentId: rootId }];
        while (stack.length) {
            const current = stack.shift();
            if (!current.element) continue;
            for (const child of current.element.children || []) {
                if (!isVisible(child)) continue;
                const role = roleFor(child);
                const name = nameFor(child);
                const interesting = INTERACTIVE_ROLES.has(role) || Boolean(name);
                if (!interesting) {
                    stack.push({ element: child, parentId: current.parentId });
                    continue;
                }
                const backendId = ensureBackendId(child);
                const node = {
                    nodeId: backendId,
                    childIds: [],
                    backendDOMNodeId: backendId,
                    role: ax(role),
                    name: ax(name),
                    properties: propertiesFor(child, role),
                };
                if ('value' in child && child.value !== undefined && child.value !== '') {
                    node.value = ax(String(child.value));
                }
                nodes.push(node);
                const parent = nodes.find((item) => item.nodeId === current.parentId);
                parent?.childIds.push(backendId);
                stack.push({ element: child, parentId: backendId });
            }
        }
        return nodes;
    }

    function jsonResult(value) {
        if (value === undefined) return { result: { type: 'undefined' } };
        if (typeof value === 'function' || (typeof Element !== 'undefined' && value instanceof Element)) {
            return { result: { type: 'object', value: null } };
        }
        try {
            return {
                result: {
                    type: value === null ? 'object' : typeof value,
                    value: JSON.parse(JSON.stringify(value)),
                },
            };
        } catch {
            return { result: { type: 'string', value: String(value) } };
        }
    }

    function exceptionResult(error) {
        return {
            exceptionDetails: {
                text: error?.message || String(error),
                exception: { description: String(error) },
            },
        };
    }

    function argumentValue(argument) {
        if (argument && argument.objectId) return elementByBackendId(argument.objectId);
        return argument ? argument.value : undefined;
    }

    async function evaluateExpression(expression) {
        const runner = new Function(`"use strict"; return (${expression});`);
        const value = await runner.call(globalThis);
        return jsonResult(value);
    }

    async function callFunctionOn(params) {
        const target = elementByBackendId(params.objectId);
        if (!target) throw new Error('Element is detached from the DOM.');
        const fn = new Function(`"use strict"; return (${params.functionDeclaration});`).call(globalThis);
        const args = (params.arguments || []).map(argumentValue);
        const value = await fn.apply(target, args);
        return jsonResult(value);
    }

    function dispatchMouse(params) {
        const target = document.elementFromPoint(params.x, params.y) || document.body;
        const map = {
            mouseMoved: ['mousemove'],
            mousePressed: ['pointerdown', 'mousedown'],
            mouseReleased: ['pointerup', 'mouseup', 'click'],
        };
        const types = map[params.type] || ['mousemove'];
        for (const type of types) {
            const EventCtor = type.startsWith('pointer') && globalThis.PointerEvent ? PointerEvent : MouseEvent;
            target.dispatchEvent(
                new EventCtor(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: params.x,
                    clientY: params.y,
                    button: 0,
                    buttons: params.type === 'mousePressed' ? 1 : 0,
                })
            );
        }
        return {};
    }

    function dispatchKey(params) {
        const target = document.activeElement || document.body;
        const type = params.type === 'keyUp' ? 'keyup' : 'keydown';
        target.dispatchEvent(
            new KeyboardEvent(type, {
                bubbles: true,
                cancelable: true,
                key: params.key || '',
                code: params.code || '',
            })
        );
        if (type === 'keydown' && params.key === 'Backspace' && target && 'value' in target) {
            const setter = Object.getOwnPropertyDescriptor(
                target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value'
            )?.set;
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? start;
            const next =
                start === end
                    ? String(target.value).slice(0, Math.max(0, start - 1)) + String(target.value).slice(end)
                    : String(target.value).slice(0, start) + String(target.value).slice(end);
            if (setter) setter.call(target, next);
            else target.value = next;
            target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        }
        return {};
    }

    function insertText(text) {
        const target = document.activeElement;
        if (!target) return {};
        if (target.isContentEditable) {
            document.execCommand('insertText', false, text);
            return {};
        }
        if (!('value' in target)) return {};
        const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const start = target.selectionStart ?? String(target.value).length;
        const end = target.selectionEnd ?? start;
        const next = String(target.value).slice(0, start) + text + String(target.value).slice(end);
        if (setter) setter.call(target, next);
        else target.value = next;
        if (typeof target.setSelectionRange === 'function') {
            const caret = start + text.length;
            target.setSelectionRange(caret, caret);
        }
        target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
        return {};
    }

    function boxModel(backendNodeId) {
        const element = elementByBackendId(backendNodeId);
        if (!element) throw new Error('Node is detached');
        const rect = element.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0 && !element.getClientRects().length)) {
            throw new Error('No box model');
        }
        const { left, top, right, bottom } = rect;
        return {
            model: {
                content: [left, top, right, top, right, bottom, left, bottom],
            },
        };
    }

    function openDialog(type, message, defaultPrompt) {
        agent.pendingDialog = {
            type,
            message: String(message ?? ''),
            defaultPrompt: defaultPrompt ? String(defaultPrompt) : '',
        };
        return agent.pendingDialog;
    }

    function installDialogHooks() {
        if (agent.dialogsInstalled) return;
        agent.dialogsInstalled = true;
        globalThis.alert = (message) => {
            openDialog('alert', message);
        };
        globalThis.confirm = (message) => {
            openDialog('confirm', message);
            return false;
        };
        globalThis.prompt = (message, defaultValue) => {
            openDialog('prompt', message, defaultValue);
            return null;
        };
    }

    async function handleDomCommand(method, params = {}) {
        const events = [];
        const rememberDialog = agent.pendingDialog;
        try {
            let result;
            switch (method) {
                case 'Runtime.enable':
                case 'Page.enable':
                case 'DOM.enable':
                case 'Accessibility.enable':
                case 'Overlay.enable':
                case 'Target.setAutoAttach':
                    result = {};
                    break;
                case 'Overlay.hideHighlight':
                    result = {};
                    break;
                case 'Accessibility.getFullAXTree':
                    result = { nodes: buildSnapshot() };
                    break;
                case 'DOM.resolveNode':
                    result = { object: { objectId: String(params.backendNodeId) } };
                    break;
                case 'DOM.scrollIntoViewIfNeeded': {
                    const element = elementByBackendId(params.objectId || params.backendNodeId);
                    element?.scrollIntoView({ block: 'center', inline: 'center' });
                    result = {};
                    break;
                }
                case 'DOM.getBoxModel':
                    result = boxModel(params.backendNodeId || params.objectId);
                    break;
                case 'DOM.setFileInputFiles':
                    throw new Error(
                        'Firefox cannot set local file paths on an input. Choose the files in the page file picker.'
                    );
                case 'Runtime.evaluate':
                    result = await evaluateExpression(params.expression);
                    break;
                case 'Runtime.callFunctionOn':
                    result = await callFunctionOn(params);
                    break;
                case 'Input.dispatchMouseEvent':
                    result = dispatchMouse(params);
                    break;
                case 'Input.dispatchKeyEvent':
                    result = dispatchKey(params);
                    break;
                case 'Input.insertText':
                    result = insertText(params.text || '');
                    break;
                case 'Page.getFrameTree':
                    result = {
                        frameTree: {
                            frame: { id: 'gemini-nexus-root', url: globalThis.location?.href || '' },
                        },
                    };
                    break;
                case 'Page.handleJavaScriptDialog':
                    agent.pendingDialog = null;
                    events.push({ method: 'Page.javascriptDialogClosed', params: {} });
                    result = {};
                    break;
                case 'Overlay.highlightNode': {
                    const element = elementByBackendId(params.objectId || params.backendNodeId);
                    if (element) {
                        element.style.outline = '2px solid #0b57d0';
                        if (agent.highlightTimer) clearTimeout(agent.highlightTimer);
                        agent.highlightTimer = setTimeout(() => {
                            element.style.outline = '';
                        }, 1500);
                    }
                    result = {};
                    break;
                }
                default:
                    throw new Error(`Unsupported DOM control command: ${method}`);
            }
            if (agent.pendingDialog && agent.pendingDialog !== rememberDialog) {
                events.push({
                    method: 'Page.javascriptDialogOpening',
                    params: agent.pendingDialog,
                });
            }
            return { result, events };
        } catch (error) {
            if (method === 'Runtime.evaluate' || method === 'Runtime.callFunctionOn') {
                return { result: exceptionResult(error), events };
            }
            throw error;
        }
    }

    installDialogHooks();
    globalThis.__geminiNexusDomPage = {
        handleDomCommand,
        getDialog: () => agent.pendingDialog,
    };

    globalThis.addEventListener('message', (event) => {
        if (event.source !== globalThis) return;
        const raw = event.data;
        if (typeof raw !== 'string') return;
        let message;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }
        if (!message || message.type !== 'GN_DOM_CMD' || !message.requestId) return;
        handleDomCommand(message.method, message.params || {})
            .then((payload) => {
                globalThis.postMessage(
                    JSON.stringify({
                        type: 'GN_DOM_RESULT',
                        requestId: message.requestId,
                        result: payload.result,
                        events: payload.events,
                    }),
                    '*'
                );
            })
            .catch((error) => {
                globalThis.postMessage(
                    JSON.stringify({
                        type: 'GN_DOM_RESULT',
                        requestId: message.requestId,
                        error: error?.message || String(error),
                    }),
                    '*'
                );
            });
    });
})();
