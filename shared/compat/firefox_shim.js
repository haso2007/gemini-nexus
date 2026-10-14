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
 * What it does:
 *
 * 1. Promise namespace: Firefox's `chrome.*` namespace is callback-only;
 *    only `browser.*` returns promises. The codebase uses promise-style
 *    `chrome.*` calls everywhere, so when the `browser` namespace exists
 *    (Firefox) we alias `globalThis.chrome` to it. In Chrome `browser` is
 *    undefined and this is a no-op.
 *
 * 2. `chrome.sidePanel` (Chrome-only) is emulated on top of Firefox's
 *    `sidebarAction` API:
 *      - setPanelBehavior() -> no-op (Firefox has no equivalent; the
 *        sidebar toggle is separate from the action button).
 *      - open({tabId, windowId}) -> sidebarAction.open() (acts on the
 *        active window; must be called from a user gesture, same as Chrome).
 *      - setOptions({tabId, path, enabled}) -> sidebarAction.setPanel()
 *        for `path`; per-tab `enabled` has no Firefox equivalent. The
 *        `enabled: false` close hack maps to sidebarAction.close() when
 *        available, otherwise it is a no-op.
 *
 * 3. `chrome.debugger` does not exist in Firefox. It is left undefined here;
 *    background/control/connection.js feature-detects it and disables the
 *    CDP-based browser-control feature with a clear error message.
 *
 * 4. `chrome.tabGroups` does not exist in Firefox either; callers already
 *    feature-detect it (background/managers/control_manager.js) and skip
 *    the native tab-group indicator.
 */

(function () {
    'use strict';

    var g = globalThis;

    // Capture the real namespaces before aliasing.
    var browserNS = g.browser;
    var originalChrome = g.chrome;

    // 1. Prefer the promise-based namespace when available (Firefox).
    if (browserNS && browserNS !== originalChrome) {
        try {
            g.chrome = browserNS;
        } catch (aliasError) {
            // If the alias cannot be installed, keep going: feature shims
            // below still attach to whichever namespace object exists.
        }
    }

    var chrome = g.chrome;
    if (!chrome) {
        return;
    }

    function toAbsoluteUrl(path) {
        if (!path) return path;
        if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
        try {
            if (chrome.runtime && typeof chrome.runtime.getURL === 'function') {
                return chrome.runtime.getURL(path);
            }
        } catch (urlError) {
            // Fall through and return the path unchanged.
        }
        return path;
    }

    // 2. sidePanel -> sidebarAction adapter (Firefox only).
    if (!chrome.sidePanel && browserNS && browserNS.sidebarAction) {
        var sidebarAction = browserNS.sidebarAction;

        chrome.sidePanel = {
            setPanelBehavior: function () {
                return Promise.resolve();
            },

            open: function () {
                try {
                    return sidebarAction.open();
                } catch (openError) {
                    return Promise.reject(openError);
                }
            },

            setOptions: function (options) {
                options = options || {};
                var tasks = [];

                if (options.path) {
                    var details = { panel: toAbsoluteUrl(options.path) };
                    if (options.tabId != null) {
                        details.tabId = options.tabId;
                    }
                    tasks.push(
                        sidebarAction.setPanel(details).catch(function () {
                            // Best effort: setting a per-tab panel may fail
                            // on tabs where sidebars are unavailable.
                        })
                    );
                } else if (options.enabled === false) {
                    // Closest equivalent to Chrome's disable/close hack.
                    if (typeof sidebarAction.close === 'function') {
                        tasks.push(
                            sidebarAction.close().catch(function () {})
                        );
                    }
                }

                return Promise.all(tasks).then(function () {});
            },

            getOptions: function () {
                return Promise.resolve({});
            },
        };
    }

    // 3. chrome.debugger: intentionally NOT stubbed. Firefox does not
    // implement it, and background/control/connection.js detects its absence
    // to disable the browser-control feature with a clear message.
})();
