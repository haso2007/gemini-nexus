export class UIPanelActions {
  constructor(controlManager, deps = {}) {
    this.controlManager = controlManager;
    this.sidePanel = deps.sidePanel || chrome.sidePanel;
    this.storage = deps.storage || chrome.storage.local;
    this.runtime = deps.runtime || chrome.runtime;
    this.tabs = deps.tabs || chrome.tabs;
  }

  async openSidePanel(request, sender) {
    if (!sender.tab) return;

    const openPromise = this.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId })
      .catch((err) => console.error('Could not open side panel:', err));

    const updateOps = {};
    if (request.sessionId) updateOps.pendingSessionId = request.sessionId;
    if (request.mode) updateOps.pendingMode = request.mode;

    if (Object.keys(updateOps).length > 0) {
      await this.storage.set(updateOps);
      setTimeout(() => {
        this.storage.remove(Object.keys(updateOps));
      }, 5000);
    }

    try { await openPromise; } catch {}

    setTimeout(() => {
      if (request.sessionId) {
        this.runtime.sendMessage({
          action: 'SWITCH_SESSION',
          sessionId: request.sessionId,
        }).catch(() => {});
      }
      if (request.mode === 'browser_control') {
        this.runtime.sendMessage({
          action: 'ACTIVATE_BROWSER_CONTROL',
        }).catch(() => {});
      }
    }, 500);
  }

  async toggleSidePanelControl(request, sender) {
    if (!sender.tab) return;

    const tabId = sender.tab.id;
    const currentLock = this.controlManager ? this.controlManager.getTargetTabId() : null;
    const isControlActive = currentLock === tabId;

    if (isControlActive) {
      if (this.controlManager) {
        await this.controlManager.disableControl();
      }

      try {
        await this.sidePanel.setOptions({ tabId, enabled: false });
        setTimeout(() => {
          this.sidePanel.setOptions({ tabId, enabled: true, path: 'sidepanel/index.html' });
        }, 250);
      } catch (e) {
        console.error('Failed to toggle side panel close:', e);
      }
      return;
    }

    await this.openSidePanel({ ...request, mode: 'browser_control' }, sender);
  }

  getOpenTabs(sendResponse) {
    (async () => {
      const tabs = await this.tabs.query({ currentWindow: true });
      const safeTabs = tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        active: tab.active,
      }));

      const lockedTabId = this.controlManager ? this.controlManager.getTargetTabId() : null;

      this.runtime.sendMessage({
        action: 'OPEN_TABS_RESULT',
        tabs: safeTabs,
        lockedTabId,
      }).catch(() => {});
      sendResponse({ status: 'completed' });
    })();
    return true;
  }

  switchTab(request, sendResponse) {
    if (this.controlManager) {
      this.controlManager.setTargetTab(request.tabId || null);
    }
    if (request.tabId && request.switchVisual !== false) {
      this.tabs.update(request.tabId, { active: true }).catch((err) => console.warn(err));
    }
    sendResponse({ status: 'switched' });
    return true;
  }

  toggleBrowserControl(request, sendResponse) {
    if (this.controlManager) {
      if (request.enabled) {
        this.controlManager.enableControl();
      } else {
        this.controlManager.disableControl();
      }
    }
    sendResponse({ status: 'processed' });
    return true;
  }
}
