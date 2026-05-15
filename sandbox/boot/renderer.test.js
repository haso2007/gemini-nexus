// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initRendererMode } from './renderer.js';

vi.mock('./loader.js', () => ({
    loadLibs: vi.fn(),
}));

vi.mock('../../shared/utils/index.js', () => ({
    getHighResImageUrl: (url) => `${url}?highres=1`,
}));

vi.mock('../../shared/media/watermark_remover.js', () => ({
    WatermarkRemover: {
        process: vi.fn(),
    },
}));

describe('renderer mode', () => {
    beforeEach(() => {
        document.body.innerHTML = '<p>old ui</p>';
    });

    it('renders every generated image and returns a fetch task for each one', async () => {
        const postMessage = vi.fn();
        const event = new MessageEvent('message', {
            data: {
                action: 'RENDER',
                reqId: 7,
                text: 'done',
                images: [
                    { url: 'https://example.test/one.png', alt: 'one' },
                    {
                        url: 'https://example.test/two.png',
                        alt: 'two" onerror="alert(1)',
                    },
                ],
            },
        });
        Object.defineProperty(event, 'source', {
            value: { postMessage },
        });

        initRendererMode();
        window.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledTimes(1);
        const [payload] = postMessage.mock.calls[0];
        const html = document.createElement('div');
        html.innerHTML = payload.html;

        expect(payload.reqId).toBe(7);
        expect(html.querySelectorAll('.generated-image')).toHaveLength(2);
        expect(html.querySelector('.generated-image[onerror]')).toBeNull();
        expect(payload.fetchTasks).toEqual([
            {
                reqId: expect.stringMatching(/^gen_img_/),
                url: 'https://example.test/one.png?highres=1',
            },
            {
                reqId: expect.stringMatching(/^gen_img_/),
                url: 'https://example.test/two.png?highres=1',
            },
        ]);
    });
});
