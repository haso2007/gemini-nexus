import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UIPanelActions } from '../../background/handlers/ui_panel_actions.js';

describe('UIPanelActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.chrome = {
      sidePanel: {
        open: vi.fn().mockResolvedValue(undefined),
        setOptions: vi.fn().mockResolvedValue(undefined),
      },
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        update: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab', url: 'https://example.com', favIconUrl: '', active: true },
        ]),
      },
    };
  });

  test('switchTab updates lock state and visual tab by default', () => {
    const controlManager = { setTargetTab: vi.fn(), getTargetTabId: vi.fn().mockReturnValue(null) };
    const actions = new UIPanelActions(controlManager);
    const sendResponse = vi.fn();

    const handled = actions.switchTab({ tabId: 99 }, sendResponse);

    expect(handled).toBe(true);
    expect(controlManager.setTargetTab).toHaveBeenCalledWith(99);
    expect(chrome.tabs.update).toHaveBeenCalledWith(99, { active: true });
    expect(sendResponse).toHaveBeenCalledWith({ status: 'switched' });
  });

  test('openSidePanel stores pending state and schedules follow-up messages', async () => {
    const actions = new UIPanelActions({ getTargetTabId: vi.fn() });

    await actions.openSidePanel({ sessionId: 'session_1', mode: 'browser_control' }, { tab: { id: 5, windowId: 7 } });

    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 5, windowId: 7 });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ pendingSessionId: 'session_1', pendingMode: 'browser_control' });

    vi.runAllTimers();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'SWITCH_SESSION', sessionId: 'session_1' });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'ACTIVATE_BROWSER_CONTROL' });
  });
});
