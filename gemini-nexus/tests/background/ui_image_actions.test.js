import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UIImageActions } from '../../background/handlers/ui_image_actions.js';

describe('UIImageActions', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 5, windowId: 7 }]),
        sendMessage: vi.fn().mockResolvedValue({ selection: 'hello' }),
      },
    };
  });

  test('forwards crop results back to runtime for sidepanel processing', () => {
    const actions = new UIImageActions({}, {});
    const sendResponse = vi.fn();

    const handled = actions.processCropInSidepanel({ payload: { action: 'CROP_SCREENSHOT' } }, sendResponse);

    expect(handled).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'CROP_SCREENSHOT' });
    expect(sendResponse).toHaveBeenCalledWith({ status: 'forwarded' });
  });

  test('requests active selection from the current tab', async () => {
    const actions = new UIImageActions({}, {});
    const sendResponse = vi.fn();

    const handled = actions.getActiveSelection(sendResponse);
    expect(handled).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { action: 'GET_SELECTION' });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'SELECTION_RESULT',
      text: 'hello',
    });
    expect(sendResponse).toHaveBeenCalledWith({ status: 'completed' });
  });
});
