import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitForHelper } from './wait_helper.js';

describe('WaitForHelper event waits', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function createConnection() {
        let listener = null;
        return {
            attached: true,
            addListener: vi.fn((handler) => {
                listener = handler;
            }),
            removeListener: vi.fn((handler) => {
                if (listener === handler) listener = null;
            }),
            emit(method, params = {}) {
                if (listener) listener(method, params);
            },
        };
    }

    it('removes the navigation-start listener after timeout', async () => {
        const connection = createConnection();
        const helper = new WaitForHelper(connection);
        const wait = helper._waitForNavigationStart();

        await vi.advanceTimersByTimeAsync(helper.timeouts.expectNavigationIn);

        await expect(wait).resolves.toBe(false);
        expect(connection.removeListener).toHaveBeenCalledTimes(1);
    });

    it('removes the load-event listener after the event fires', async () => {
        const connection = createConnection();
        const helper = new WaitForHelper(connection);
        const wait = helper._waitForLoadEvent();

        connection.emit('Page.loadEventFired');

        await expect(wait).resolves.toBe(true);
        expect(connection.removeListener).toHaveBeenCalledTimes(1);
    });
});
