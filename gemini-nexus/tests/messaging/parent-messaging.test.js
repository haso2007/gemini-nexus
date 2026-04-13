import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  downloadImageFromParent,
  downloadLogsFromParent,
  openFullPage,
  saveModelToStorage,
  signalUiReady,
} from '../../lib/messaging.js';

describe('parent messaging helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('signals when the sandbox UI is ready', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    signalUiReady();

    expect(postMessage).toHaveBeenCalledWith(
      { action: 'UI_READY' },
      window.location.origin
    );
  });

  test('opens the full-page sidepanel shell via parent bridge', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    openFullPage();

    expect(postMessage).toHaveBeenCalledWith(
      { action: 'OPEN_FULL_PAGE' },
      window.location.origin
    );
  });

  test('saves the selected model through the parent bridge', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    saveModelToStorage('gemini-3-pro');

    expect(postMessage).toHaveBeenCalledWith(
      { action: 'SAVE_MODEL', payload: 'gemini-3-pro' },
      window.location.origin
    );
  });

  test('requests image download through the parent shell', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    downloadImageFromParent('https://example.com/image.png', 'image.png');

    expect(postMessage).toHaveBeenCalledWith(
      {
        action: 'DOWNLOAD_IMAGE',
        payload: {
          url: 'https://example.com/image.png',
          filename: 'image.png',
        },
      },
      window.location.origin
    );
  });

  test('requests log download through the parent shell', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');

    downloadLogsFromParent('line-1', 'logs.txt');

    expect(postMessage).toHaveBeenCalledWith(
      {
        action: 'DOWNLOAD_LOGS',
        payload: {
          text: 'line-1',
          filename: 'logs.txt',
        },
      },
      window.location.origin
    );
  });
});
