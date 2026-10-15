import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

describe('shared/compat/firefox_shim', () => {
  const shimSource = fs.readFileSync(path.resolve(__dirname, 'firefox_shim.js'), 'utf8');

  function createFirefoxSandbox() {
    class StorageArea {
      constructor() {
        this.data = {};
      }
      get(keys) {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach((key) => {
            result[key] = this.data[key];
          });
        }
        return Promise.resolve(result);
      }
      set(items) {
        Object.assign(this.data, items);
        return Promise.resolve();
      }
    }

    class EventManager {
      constructor() {
        this.listeners = [];
      }
      addListener(fn) {
        this.listeners.push(fn);
      }
      emit(...args) {
        this.listeners.forEach((fn) => fn(...args));
      }
    }

    const sidebarCalls = {
      openArgs: [],
      closeCount: 0,
      toggleCount: 0,
      panels: new Map(),
      isOpenState: false,
    };

    const browser = {
      runtime: {
        id: 'test-id',
        getURL(relPath) {
          return `moz-extension://uuid/${relPath}`;
        },
        sendMessage(message) {
          return Promise.resolve({ ack: message });
        },
        onMessage: new EventManager(),
      },
      storage: {
        local: new StorageArea(),
        session: new StorageArea(),
        onChanged: new EventManager(),
      },
      tabs: {
        query(_filter) {
          return Promise.resolve([{ id: 42, active: true }]);
        },
        getCurrent() {
          return Promise.resolve({ id: 42 });
        },
      },
      sidebarAction: {
        open(...args) {
          sidebarCalls.openArgs.push(args);
          // Enforce real Firefox behavior: sidebarAction.open() rejects any arguments
          if (args.length > 0) {
            return Promise.reject(
              new TypeError('Incorrect argument types for sidebarAction.open.')
            );
          }
          sidebarCalls.isOpenState = true;
          return Promise.resolve();
        },
        close() {
          sidebarCalls.closeCount += 1;
          sidebarCalls.isOpenState = false;
          return Promise.resolve();
        },
        toggle() {
          sidebarCalls.toggleCount += 1;
          sidebarCalls.isOpenState = !sidebarCalls.isOpenState;
          return Promise.resolve();
        },
        isOpen() {
          return Promise.resolve(sidebarCalls.isOpenState);
        },
        setPanel(params) {
          const key = typeof params.tabId === 'number' ? params.tabId : 'default';
          sidebarCalls.panels.set(key, params.panel);
          return Promise.resolve();
        },
        getPanel(params) {
          const key = params && typeof params.tabId === 'number' ? params.tabId : 'default';
          return Promise.resolve(
            sidebarCalls.panels.get(key) || 'moz-extension://uuid/sidepanel/index.html'
          );
        },
      },
    };

    const context = {
      globalThis: {},
      Promise,
      Array,
      WeakMap,
      Map,
      Proxy,
      Object,
      String,
    };
    context.globalThis = context;
    context.browser = browser;

    vm.runInNewContext(shimSource, context);
    return { context, browser, sidebarCalls };
  }

  it('wraps storage.local.get to support Chrome-style callback on custom prototype objects', async () => {
    const { context, browser } = createFirefoxSandbox();
    browser.storage.local.data.geminiSessions = [{ id: 's1', title: 'hello' }];

    const result = await new Promise((resolve) => {
      context.chrome.storage.local.get(['geminiSessions'], (data) => {
        resolve(data);
      });
    });

    expect(result).toEqual({ geminiSessions: [{ id: 's1', title: 'hello' }] });
  });

  it('preserves promise-style usage when no callback is provided', async () => {
    const { context, browser } = createFirefoxSandbox();
    browser.storage.local.data.testKey = 'value';

    const result = await context.chrome.storage.local.get(['testKey']);
    expect(result).toEqual({ testKey: 'value' });
  });

  it('wraps tabs.query and tabs.getCurrent callbacks', async () => {
    const { context } = createFirefoxSandbox();

    const tabs = await new Promise((resolve) => {
      context.chrome.tabs.query({ active: true }, (items) => resolve(items));
    });
    expect(tabs).toEqual([{ id: 42, active: true }]);

    const currentTab = await new Promise((resolve) => {
      context.chrome.tabs.getCurrent((tab) => resolve(tab));
    });
    expect(currentTab).toEqual({ id: 42 });
  });

  it('handles listener methods without callback wrapping', () => {
    const { context, browser } = createFirefoxSandbox();
    let received = null;

    context.chrome.runtime.onMessage.addListener((msg) => {
      received = msg;
    });

    browser.runtime.onMessage.emit({ action: 'TEST_ACTION' });
    expect(received).toEqual({ action: 'TEST_ACTION' });
  });

  it('calls sidebarAction.open() with zero arguments when chrome.sidePanel.open({ windowId, tabId }) is invoked', async () => {
    const { context, sidebarCalls } = createFirefoxSandbox();

    await context.chrome.sidePanel.open({ windowId: 1, tabId: 42 });
    expect(sidebarCalls.openArgs).toHaveLength(1);
    expect(sidebarCalls.openArgs[0]).toEqual([]);

    await context.chrome.sidePanel.open({ tabId: 42 });
    expect(sidebarCalls.openArgs).toHaveLength(2);
    expect(sidebarCalls.openArgs[1]).toEqual([]);
  });

  it('supports Chrome-style trailing callbacks on chrome.sidePanel methods', async () => {
    const { context } = createFirefoxSandbox();

    await new Promise((resolve) => {
      context.chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }, () => {
        resolve();
      });
    });

    const behavior = await new Promise((resolve) => {
      context.chrome.sidePanel.getPanelBehavior((res) => resolve(res));
    });
    expect(behavior).toEqual({ openPanelOnActionClick: true });
  });

  it('closes the Firefox sidebar when setOptions({ tabId, enabled: false }) is called without a path', async () => {
    const { context, sidebarCalls } = createFirefoxSandbox();

    await context.chrome.sidePanel.open({ tabId: 42, windowId: 1 });
    expect(sidebarCalls.isOpenState).toBe(true);

    await context.chrome.sidePanel.setOptions({ tabId: 42, enabled: false });
    expect(sidebarCalls.closeCount).toBe(1);
    expect(sidebarCalls.isOpenState).toBe(false);
  });

  it('resolves full moz-extension URL on setOptions({ tabId, path }) and returns state via getOptions', async () => {
    const { context } = createFirefoxSandbox();

    await context.chrome.sidePanel.setOptions({
      tabId: 42,
      path: 'sidepanel/index.html?tabId=42',
      enabled: true,
    });

    const opts = await context.chrome.sidePanel.getOptions({ tabId: 42 });
    expect(opts).toEqual({
      path: 'moz-extension://uuid/sidepanel/index.html?tabId=42',
      enabled: true,
    });
  });

  it('reports chrome.runtime.lastError when callback operation fails', async () => {
    const { context, browser } = createFirefoxSandbox();
    browser.storage.local.get = () => Promise.reject(new Error('Storage failure'));

    const result = await new Promise((resolve) => {
      context.chrome.storage.local.get(['err'], (data) => {
        resolve({ data, lastError: context.chrome.runtime.lastError });
      });
    });

    expect(result.data).toBeUndefined();
    expect(result.lastError?.message).toContain('Storage failure');
  });
});