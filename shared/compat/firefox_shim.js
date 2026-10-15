/**
 * shared/compat/firefox_shim.js
 *
 * Cross-browser extension API compatibility shim (Chrome <-> Firefox).
 *
 * Load (or import) this file BEFORE any other extension code in every
 * privileged extension context: background, content scripts, and extension pages
 * (NEVER inject into sandbox/index.html or MAIN-world page scripts).
 */
(function () {
  'use strict';

  var g = globalThis;
  var browserNs = g.browser;

  // Not Firefox (Chrome/Edge/...): native `chrome` already supports both
  // promise and callback styles. Do nothing.
  if (!browserNs || typeof browserNs !== 'object') return;

  // Guard against running inside an untrusted sandboxed iframe (opaque origin).
  try {
    if (typeof g.location !== 'undefined' && g.origin === 'null') return;
  } catch (e) {}

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

  // Wrap an async API method so an optional trailing function argument is
  // treated as a Chrome-style completion callback.
  function wrapFunction(fn, owner, methodName) {
    if (LISTENER_METHODS[methodName]) {
      return typeof fn.bind === 'function' ? fn.bind(owner) : fn;
    }
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

  // --- `chrome.sidePanel` emulation via `browser.sidebarAction` ---
  var sidePanelShim = undefined;
  try {
    var sidebarAction = browserNs.sidebarAction;
    if (sidebarAction) {
      var panelState = {
        openPanelOnActionClick: false,
        defaultPath: 'sidepanel/index.html',
        defaultEnabled: true,
        tabOptions: new Map(), // tabId -> { path?: string, enabled?: boolean }
      };

      // Firefox `sidebarAction.open()` accepts ZERO arguments and must run
      // synchronously inside a user action handler.
      var openSidebar = function () {
        try {
          var result = sidebarAction.open();
          return result && typeof result.then === 'function'
            ? result
            : Promise.resolve(result);
        } catch (error) {
          return Promise.reject(error);
        }
      };

      var closeSidebar = function () {
        if (typeof sidebarAction.close !== 'function') {
          return Promise.resolve();
        }
        try {
          var result = sidebarAction.close();
          return result && typeof result.then === 'function'
            ? result
            : Promise.resolve(result);
        } catch (error) {
          return Promise.reject(error);
        }
      };

      sidePanelShim = {
        open: function (_options) {
          return openSidebar();
        },
        close: function () {
          return closeSidebar();
        },
        toggle: function () {
          if (typeof sidebarAction.toggle === 'function') {
            try {
              var res = sidebarAction.toggle();
              return res && typeof res.then === 'function' ? res : Promise.resolve(res);
            } catch (error) {
              return Promise.reject(error);
            }
          }
          return openSidebar();
        },
        isOpen: function (options) {
          if (typeof sidebarAction.isOpen !== 'function') {
            return Promise.resolve(false);
          }
          var details = {};
          if (options && typeof options.windowId === 'number') {
            details.windowId = options.windowId;
          }
          try {
            return Promise.resolve(sidebarAction.isOpen(details));
          } catch (error) {
            return Promise.resolve(false);
          }
        },
        setOptions: function (options) {
          options = options || {};
          var path = options.path;
          var tabId = options.tabId;
          var enabled = options.enabled;

          if (typeof tabId === 'number') {
            var prev = panelState.tabOptions.get(tabId) || {};
            panelState.tabOptions.set(tabId, {
              path: typeof path === 'string' ? path : prev.path,
              enabled: typeof enabled === 'boolean' ? enabled : prev.enabled,
            });
          } else {
            if (typeof path === 'string') panelState.defaultPath = path;
            if (typeof enabled === 'boolean') panelState.defaultEnabled = enabled;
          }

          // When `SidePanelScopeManager.closeForTab(tabId)` calls
          // `setOptions({ tabId, enabled: false })` without a path, close
          // the Firefox sidebar if we are in a user-action context.
          if (enabled === false && typeof path !== 'string' && typeof tabId === 'number') {
            return closeSidebar().catch(function () {
              return undefined;
            });
          }

          var chain = Promise.resolve();
          if (typeof path === 'string' && typeof sidebarAction.setPanel === 'function') {
            var resolvedPanel =
              browserNs.runtime && typeof browserNs.runtime.getURL === 'function'
                ? browserNs.runtime.getURL(path.replace(/^\/+/, ''))
                : path;
            var params = { panel: resolvedPanel };
            if (typeof tabId === 'number') params.tabId = tabId;
            chain = chain.then(function () {
              return sidebarAction.setPanel(params);
            });
          }
          return chain;
        },
        getOptions: function (options) {
          options = options || {};
          var tabId = options.tabId;
          var cached = typeof tabId === 'number' ? panelState.tabOptions.get(tabId) : undefined;
          var enabled =
            cached && typeof cached.enabled === 'boolean'
              ? cached.enabled
              : panelState.defaultEnabled;

          if (typeof sidebarAction.getPanel === 'function') {
            var query = typeof tabId === 'number' ? { tabId: tabId } : {};
            return Promise.resolve(sidebarAction.getPanel(query)).then(
              function (panelUrl) {
                return {
                  path: panelUrl || (cached && cached.path) || panelState.defaultPath,
                  enabled: enabled,
                };
              },
              function () {
                return {
                  path: (cached && cached.path) || panelState.defaultPath,
                  enabled: enabled,
                };
              }
            );
          }

          return Promise.resolve({
            path: (cached && cached.path) || panelState.defaultPath,
            enabled: enabled,
          });
        },
        setPanelBehavior: function (behavior) {
          if (behavior && typeof behavior.openPanelOnActionClick === 'boolean') {
            panelState.openPanelOnActionClick = behavior.openPanelOnActionClick;
          }
          return Promise.resolve();
        },
        getPanelBehavior: function () {
          return Promise.resolve({
            openPanelOnActionClick: panelState.openPanelOnActionClick,
          });
        },
      };
    }
  } catch (e) {}

  var proxyCache = new WeakMap();

  function wrapNamespace(target) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
      return target;
    }
    if (proxyCache.has(target)) return proxyCache.get(target);

    var proxy = new Proxy(target, {
      get: function (obj, prop) {
        if (prop === '__geminiNexusFirefoxShim') return true;
        if (prop === 'sidePanel' && sidePanelShim && !obj.sidePanel) {
          return wrapNamespace(sidePanelShim);
        }
        if (prop === 'lastError' && obj === browserNs.runtime) {
          return getLastError();
        }

        var value;
        try {
          value = obj[prop];
        } catch (e) {
          return undefined;
        }

        if (typeof value === 'function') {
          return wrapFunction(value, obj, prop);
        }
        if (typeof value === 'object' && value !== null) {
          return wrapNamespace(value);
        }
        return value;
      },
      set: function (obj, prop, val) {
        try {
          obj[prop] = val;
          return true;
        } catch (e) {
          return false;
        }
      },
      has: function (obj, prop) {
        if (prop === '__geminiNexusFirefoxShim') return true;
        if (prop === 'sidePanel' && sidePanelShim) return true;
        if (prop === 'lastError' && obj === browserNs.runtime) return true;
        return prop in obj;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  }

  var chromeShim = wrapNamespace(browserNs);

  try {
    g.chrome = chromeShim;
  } catch (e) {}
})();