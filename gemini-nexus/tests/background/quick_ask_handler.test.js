import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../background/managers/history_manager.js', () => ({
  appendAiMessage: vi.fn(),
  appendUserMessage: vi.fn(),
  saveToHistory: vi.fn(),
}));

import { QuickAskHandler } from '../../background/handlers/session/quick_ask_handler.js';
import {
  appendAiMessage,
  appendUserMessage,
  saveToHistory,
} from '../../background/managers/history_manager.js';

describe('QuickAskHandler', () => {
  beforeEach(() => {
    globalThis.chrome = {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete globalThis.chrome;
  });

  test('keeps the current session when continuing a quick ask conversation', async () => {
    const sessionManager = {
      resetContext: vi.fn(),
      ensureInitialized: vi.fn(),
      handleSendPrompt: vi.fn().mockResolvedValue({
        status: 'success',
        text: 'done',
      }),
    };
    const handler = new QuickAskHandler(sessionManager, {});

    saveToHistory.mockResolvedValue({ id: 'new_session' });

    await handler.handleQuickAsk(
      { text: 'continue', sessionId: 'session_1' },
      { tab: { id: 9 } },
    );

    expect(sessionManager.ensureInitialized).toHaveBeenCalled();
    expect(saveToHistory).not.toHaveBeenCalled();
    expect(appendUserMessage).toHaveBeenCalledWith('session_1', 'continue', null);
    expect(appendAiMessage).toHaveBeenCalledWith('session_1', {
      status: 'success',
      text: 'done',
    });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(9, {
      action: 'GEMINI_STREAM_DONE',
      result: {
        status: 'success',
        text: 'done',
      },
      sessionId: 'session_1',
    });
  });

  test('builds page-context system instructions for quick ask requests', async () => {
    const sessionManager = {
      resetContext: vi.fn(),
      ensureInitialized: vi.fn(),
      handleSendPrompt: vi.fn().mockResolvedValue({
        status: 'success',
        text: 'done',
      }),
    };
    const promptBuilder = {
      build: vi.fn().mockResolvedValue({
        systemInstruction: 'Webpage Context:\n```text\nPage body\n```',
        userPrompt: 'question',
      }),
    };
    const handler = new QuickAskHandler(sessionManager, {}, { promptBuilder });

    await handler.handleQuickAsk(
      { text: 'question', includePageContext: true },
      { tab: { id: 9 } },
    );

    expect(promptBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'question',
        includePageContext: true,
      }),
    );
    expect(sessionManager.handleSendPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'question',
        systemInstruction: expect.stringContaining('Webpage Context:'),
      }),
      expect.any(Function),
    );
  });
});
