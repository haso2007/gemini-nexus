import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionMessageHandler } from './index.js';

describe('SessionMessageHandler active prompt runs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns active prompt run snapshots without mutating prompt state', () => {
        const handler = new SessionMessageHandler({}, null, null, null);
        const runs = [{ sessionId: 'session-1', text: 'Partial reply' }];
        handler.promptHandler.getActiveRunSnapshots = vi.fn(() => runs);
        const sendResponse = vi.fn();

        const handledAsync = handler.handle(
            { action: 'GET_ACTIVE_PROMPT_RUNS' },
            {},
            sendResponse
        );

        expect(handledAsync).toBe(false);
        expect(handler.promptHandler.getActiveRunSnapshots).toHaveBeenCalledTimes(1);
        expect(sendResponse).toHaveBeenCalledWith({
            status: 'success',
            runs,
        });
    });
});
