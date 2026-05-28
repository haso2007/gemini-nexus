import { describe, expect, it, vi } from 'vitest';
import { injectBrowserControlSnapshot } from './tool_loop.js';

describe('browser-control tool loop handling', () => {
    it('does not inject a fresh page snapshot into failed browser-control outputs', async () => {
        const controlManager = {
            getSnapshot: vi.fn(() => Promise.resolve('snapshot')),
        };

        const output = await injectBrowserControlSnapshot({
            toolResult: {
                source: 'browser_control',
                toolName: 'click',
                status: 'failed',
            },
            outputForModel: 'Error: Element is detached.',
            request: {
                enableBrowserControl: true,
            },
            controlManager,
        });

        expect(output).toBe('Error: Element is detached.');
        expect(controlManager.getSnapshot).not.toHaveBeenCalled();
    });
});
