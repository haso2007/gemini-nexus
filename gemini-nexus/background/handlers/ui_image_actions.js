import { resolveWindowId, sendPayloadToSender } from './ui_helpers.js';
import { getActiveTabContent } from './session/utils.js';

export class UIImageActions {
  constructor(imageHandler, deps = {}) {
    this.imageHandler = imageHandler;
    this.tabs = deps.tabs || chrome.tabs;
    this.runtime = deps.runtime || chrome.runtime;
  }

  fetchImage(request, sendResponse) {
    (async () => {
      try {
        const result = await this.imageHandler.fetchImage(request.url);
        this.runtime.sendMessage(result).catch(() => {});
      } catch (e) {
        console.error('Fetch image error', e);
      } finally {
        sendResponse({ status: 'completed' });
      }
    })();
    return true;
  }

  fetchGeneratedImage(request, sender, sendResponse) {
    (async () => {
      try {
        const result = await this.imageHandler.fetchImage(request.url);
        const payload = {
          action: 'GENERATED_IMAGE_RESULT',
          reqId: request.reqId,
          base64: result.base64,
          error: result.error,
        };
        await sendPayloadToSender(sender, payload, { tabs: this.tabs, runtime: this.runtime });
      } catch (e) {
        console.error('Fetch generated image error', e);
        await sendPayloadToSender(sender, {
          action: 'GENERATED_IMAGE_RESULT',
          reqId: request.reqId,
          error: e.message,
        }, { tabs: this.tabs, runtime: this.runtime });
      } finally {
        sendResponse({ status: 'completed' });
      }
    })();
    return true;
  }

  captureScreenshot(sender, sendResponse) {
    (async () => {
      try {
        const windowId = await resolveWindowId(sender, this.tabs.query.bind(this.tabs));
        const result = await this.imageHandler.captureScreenshot(windowId);
        this.runtime.sendMessage(result).catch(() => {});
      } catch (e) {
        console.error('Screenshot error', e);
      } finally {
        sendResponse({ status: 'completed' });
      }
    })();
    return true;
  }

  initiateCapture(request) {
    (async () => {
      const [tab] = await this.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) {
        const capture = await this.imageHandler.captureScreenshot(tab.windowId);
        this.tabs.sendMessage(tab.id, {
          action: 'START_SELECTION',
          image: capture.base64,
          mode: request.mode,
          source: request.source,
        }).catch(() => {});
      }
    })();
    return false;
  }

  areaSelected(request, sender, sendResponse) {
    (async () => {
      try {
        const windowId = sender.tab ? sender.tab.windowId : null;
        const result = await this.imageHandler.captureArea(request.area, windowId);
        if (result && sender.tab) {
          this.tabs.sendMessage(sender.tab.id, result).catch(() => {});
        }
      } catch (e) {
        console.error('Area capture error', e);
      } finally {
        sendResponse({ status: 'completed' });
      }
    })();
    return true;
  }

  processCropInSidepanel(request, sendResponse) {
    this.runtime.sendMessage(request.payload).catch(() => {});
    sendResponse({ status: 'forwarded' });
    return true;
  }

  getActiveSelection(sendResponse) {
    (async () => {
      const [tab] = await this.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) {
        try {
          const response = await this.tabs.sendMessage(tab.id, { action: 'GET_SELECTION' });
          this.runtime.sendMessage({
            action: 'SELECTION_RESULT',
            text: response ? response.selection : '',
          }).catch(() => {});
        } catch {
          this.runtime.sendMessage({ action: 'SELECTION_RESULT', text: '' }).catch(() => {});
        }
      }
      sendResponse({ status: 'completed' });
    })();
    return true;
  }

  checkPageContext(sendResponse) {
    (async () => {
      const content = await getActiveTabContent();
      const length = content ? content.length : 0;
      sendResponse({ action: 'PAGE_CONTEXT_RESULT', length });
    })();
    return true;
  }
}
