import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PromptHandler } from '../../background/handlers/session/prompt_handler.js';

describe('PromptHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  test('caps tool loops when no maxLoops is provided', async () => {
    let attempts = 0;
    const sessionManager = {
      handleSendPrompt: vi.fn().mockImplementation(async () => {
        attempts += 1;
        if (attempts > 5) {
          throw new Error('loop exceeded');
        }

        return {
          status: 'success',
          text: '```json\n{"tool":"demo","args":{}}\n```',
        };
      }),
    };
    const mcpManager = {};
    const handler = new PromptHandler(sessionManager, null, mcpManager);

    handler.builder.build = vi.fn().mockResolvedValue({
      systemInstruction: '',
      userPrompt: 'start',
    });
    handler.toolExecutor.executeIfPresent = vi.fn().mockResolvedValue({
      toolName: 'demo',
      output: 'ok',
      files: null,
      source: 'mcp_remote',
    });

    const completed = new Promise((resolve) => {
      handler.handle(
        { text: 'start', enableMcpTools: true },
        resolve,
      );
    });

    await vi.runAllTimersAsync();
    await completed;

    expect(sessionManager.handleSendPrompt).toHaveBeenCalledTimes(5);
  });
});
