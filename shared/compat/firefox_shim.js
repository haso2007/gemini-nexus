/**
 * shared/compat/firefox_shim.js
 *
 * Cross-browser extension API compatibility shim (Chrome <-> Firefox).
 *
 * Load (or import) this file BEFORE any other extension code in every
 * extension context: background, content scripts, extension pages. It is
 * intentionally written without import/export so it works both as a classic
 * script (manifest `content_scripts`) and as an ES module import.
 *
 * What it does (Firefox only):
 *
 * 1. Chrome-style callbacks: the codebase was written against Chrome's
 *    `chrome.*`, which accepts an optional trailing callback on async methods
 *    (e.g. `chrome.storage.local.get(keys, cb)`, `chrome.tabs.getCurrent(cb)`)
 *    and reports failures via `chrome.runtime.lastError` inside the callback.
 *    Modern Firefox unifies `chrome` and `browser` into a single promise-only
 *    namespace, so those callbacks were silently ignored: storage reads never
 *    fired, `new Promise` wrappers around `chrome.tabs.getCurrent(cb)` hung
 *    forever, and features like Data Management import appeared dead.
 *    The shim wraps the `browser.*` namespace so every async method accepts
 *    an optional Chrome-style trailing callback (wired to the underlying
 *    promise, with `runtime.lastError` semantics), while plain promise usage
 *    passes through untouched.
 *
 * 2. `chrome.sidePanel` (Chrome-only) is emulated on top of Firefox's
 *    `sidebarAction` API (best effort; see docs/firefox.md).
 *
 * In real Chrome `globalThis.browser` is undefined and this file is a no-op:
 * the native `chrome` namespace already supports both styles.
 */
(function () {
    'use strict';

    var g = globalThis;
    var browserNs = g.browser;

    // Not Firefox (Chrome/Edge/...): native `chrome` already supports both
    // promise and callback styles. Do nothing.
    if (!browserNs || typeof browserNs !== 'object') return;

    // Already shimmed (e.g. evaluated twice via multiple bundles).
    try {
        if (g.chrome && g.chrome.__geminiNexusFirefoxShim) return;
    } catch (e) {}

    // --- `chrome.runtime.lastError` state (Chrome semantics) ---
    var lastErrorValue = undefined;
    function getLastError() {
        return lastErrorValue;
    }
    function setLastError(err) {
        lastErrorValue =
            err == null ? undefined : { message: String((err && err.message) || err) };
    }

    // Method names that receive a *listener*, not a completion callback.
    // These must never be treated as callback-style invocations.
    var LISTENER_METHODS = {
        addListener: true,
        removeListener: true,
        hasListener: true,
        hasListeners: true,
    };

    var wrappedCache = new WeakMap();

    function isWrappableObject(value) {
        if (!value) return false;
        if (typeof value === 'function') return true;
        if (typeof value !== 'object') return false;
        var proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    // Wrap an async API method so an optional trailing function argument is
    // treated as a Chrome-style completion callback.
    function wrapFunction(fn, owner, methodName) {
        if (LISTENER_METHODS[methodName]) return fn;
        return function () {
            var args = Array.prototype.slice.call(arguments);
            var lastArg = args.length ? args[args.length - 1] : undefined;
            if (typeof lastArg === 'function') {
                var callback = args.pop();
                var result;
                try {
                    result = fn.apply(owner, args);
                } catch (syncError) {
                    setLastError(syncError);
                    try {
                        callback(undefined);
                    } catch (ignored) {}
                    return undefined;
                }
                Promise.resolve(result).then(
                    function (value) {
                        setLastError(undefined);
                        try {
                            callback(value);
                        } catch (ignored) {}
                    },
                    function (asyncError) {
                        setLastError(asyncError);
                        try {
                            callback(undefined);
                        } catch (ignored) {}
                    }
                );
                return undefined;
            }
            return fn.apply(owner, args);
        };
    }

    // Recursively wrap an API namespace object. Non-plain objects (DOM nodes,
    // class instances, etc.) are passed through untouched.
    function wrapNamespace(obj) {
        if (!isWrappableObject(obj)) return obj;
        if (wrappedCache.has(obj)) return wrappedCache.get(obj);
        var wrapped = {};
        wrappedCache.set(obj, wrapped);
        var keys;
        try {
            keys = Object.keys(obj);
        } catch (e) {
            return obj;
        }
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value;
            try {
                value = obj[key];
            } catch (e) {
                continue;
            }
            if (typeof value === 'function') {
                wrapped[key] = wrapFunction(value, obj, key);
            } else if (isWrappableObject(value)) {
                wrapped[key] = wrapNamespace(value);
            } else {
                wrapped[key] = value;
            }
        }
        return wrapped;
    }

    var chromeShim = wrapNamespace(browserNs);

    // Chrome-compatible `runtime.lastError` as a live getter.
    try {
        if (chromeShim.runtime) {
            Object.defineProperty(chromeShim.runtime, 'lastError', {
                get: getLastError,
                configurable: true,
                enumerable: true,
            });
        }
    } catch (e) {}

    // Mark the shim so a second evaluation is a no-op.
    try {
        Object.defineProperty(chromeShim, '__geminiNexusFirefoxShim', {
            value: true,
            configurable: true,
            enumerable: false,
        });
    } catch (e) {}

    // --- `chrome.sidePanel` emulation via `sidebarAction` (best effort) ---
    try {
        var sidebarAction = chromeShim.sidebarAction;
        if (sidebarAction && !chromeShim.sidePanel) {
            var openPanelForWindow = function (windowId) {
                try {
                    var result = sidebarAction.open({ windowId: windowId });
                    return result && typeof result.then === 'function'
                        ? result
                        : Promise.resolve(result);
                } catch (error) {
                    return Promise.reject(error);
                }
            };

            chromeShim.sidePanel = {
                open: function (options) {
                    var windowId =
                        options && typeof options.windowId === 'number'
                            ? options.windowId
                            : undefined;
                    if (typeof windowId === 'number') {
                        return openPanelForWindow(windowId);
                    }
                    return Promise.resolve();
                },
                setOptions: function (options) {
                    options = options || {};
                    var path = options.path;
                    var tabId = options.tabId;
                    var enabled = options.enabled;
                    var chain = Promise.resolve();
                    if (typeof path === 'string') {
                        var params = { panel: path };
                        if (typeof tabId === 'number') params.tabId = tabId;
                        chain = chain.then(function () {
                            return sidebarAction.setPanel(params);
                        });
                    }
                    if (typeof enabled === 'boolean' && typeof tabId === 'number') {
                        chain = chain.then(function () {
                            if (typeof sidebarAction.setEnabled === 'function') {
                                return sidebarAction.setEnabled({ tabId: tabId, enabled: enabled });
                            }
                            return undefined;
                        });
                    }
                    return chain;
                },
                setPanelBehavior: function () {
                    return Promise.resolve();
                },
                getOptions: function () {
                    return Promise.resolve({});
                },
            };
        }
    } catch (e) {}

    // Install as the global `chrome` namespace.
    try {
        g.chrome = chromeShim;
    } catch (e) {
        // If the assignment is not permitted, leave the native namespace in
        // place (older Firefox `chrome` already supports callbacks).
    }
})();
