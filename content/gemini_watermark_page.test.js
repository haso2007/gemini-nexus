// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GEMINI_IMAGE_URL = 'https://lh3.googleusercontent.com/gg/sample-token=s640-rw?authuser=0';
const GEMINI_ORIGINAL_URL = 'https://lh3.googleusercontent.com/gg/sample-token=s0-rw?authuser=0';

let originalFetch;
let samplePixels;
let fillRectCalls;
let drawImageCalls;
let bridgeRequests;
let createdObjectUrls;
let mutationObserverCallback;

function makeSamplePixels(rgb) {
    const pixels = new Uint8ClampedArray(5 * 5 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = rgb[0];
        pixels[index + 1] = rgb[1];
        pixels[index + 2] = rgb[2];
        pixels[index + 3] = 255;
    }
    return pixels;
}

function makeImageBlob(type = 'image/jpeg') {
    return new Blob(['original'], { type });
}

function installDomMocks() {
    const realCreateElement = document.createElement.bind(document);

    class MockImage {
        set src(value) {
            this._src = value;
            this.width = 1200;
            this.height = 900;
            queueMicrotask(() => this.onload?.());
        }

        get src() {
            return this._src;
        }
    }

    class MockMutationObserver {
        constructor(callback) {
            mutationObserverCallback = callback;
        }

        observe = vi.fn();
    }

    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('MutationObserver', MockMutationObserver);
    vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn((blob) => {
            const objectUrl = `blob:processed-${createdObjectUrls.length}`;
            createdObjectUrls.push({ blob, objectUrl });
            return objectUrl;
        }),
        revokeObjectURL: vi.fn(),
    });

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName !== 'canvas') {
            return realCreateElement(tagName);
        }

        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => context),
            toBlob: vi.fn((callback, type) => {
                callback(new Blob(['processed'], { type }));
            }),
        };

        const context = {
            fillStyle: '',
            drawImage: vi.fn((...args) => {
                drawImageCalls.push(args);
            }),
            fillRect: vi.fn((...args) => {
                fillRectCalls.push({ args, fillStyle: context.fillStyle });
            }),
            getImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(samplePixels),
            })),
        };

        return canvas;
    });
}

async function installScript() {
    vi.resetModules();
    await import('./gemini_watermark_page.js');
}

function flushMicrotasks() {
    return Promise.resolve().then(() => Promise.resolve());
}

describe('Gemini page watermark cleanup', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();

        samplePixels = makeSamplePixels([16, 32, 48]);
        fillRectCalls = [];
        drawImageCalls = [];
        bridgeRequests = [];
        createdObjectUrls = [];
        mutationObserverCallback = null;
        delete window.GeminiNexusWatermarkPage;

        originalFetch = vi.fn(() =>
            Promise.resolve(
                new Response(makeImageBlob(), {
                    status: 200,
                    headers: { 'content-type': 'image/jpeg' },
                })
            )
        );
        vi.stubGlobal('fetch', originalFetch);
        window.fetch = originalFetch;
        vi.spyOn(window, 'postMessage').mockImplementation((message) => {
            if (message?.type === 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_REQUEST') {
                bridgeRequests.push(message);
            }
        });
        installDomMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rewrites matching Gemini image fetches to original size and returns a processed image response', async () => {
        await installScript();

        const responsePromise = window.fetch(GEMINI_IMAGE_URL);
        await vi.runAllTimersAsync();
        const response = await responsePromise;

        expect(originalFetch).toHaveBeenCalledWith(GEMINI_ORIGINAL_URL);
        expect(response).toBeInstanceOf(Response);
        expect(response.headers.get('content-type')).toBe('image/jpeg');
        expect(fillRectCalls).toEqual([
            {
                args: [1116, 816, 56, 56],
                fillStyle: 'rgb(16, 32, 48)',
            },
        ]);
        expect(drawImageCalls[1]).toEqual([
            expect.any(Object),
            1060,
            816,
            56,
            56,
            1116,
            816,
            56,
            56,
        ]);
    });

    it('disables Gemini image fetch cleanup when the shared setting is off', async () => {
        await installScript();

        window.dispatchEvent(
            new MessageEvent('message', {
                source: window,
                data: {
                    source: 'GeminiNexus',
                    type: 'GEMINI_NEXUS_WATERMARK_REMOVAL_ENABLED',
                    enabled: false,
                },
            })
        );

        await window.fetch(GEMINI_IMAGE_URL);

        expect(originalFetch).toHaveBeenCalledWith(GEMINI_IMAGE_URL);
        expect(fillRectCalls).toEqual([]);
    });

    it('replaces matching page images via the extension bridge before falling back to page fetch', async () => {
        await installScript();
        const image = document.createElement('img');
        image.src = GEMINI_IMAGE_URL;
        document.body.append(image);

        window.GeminiNexusWatermarkPage.processPageImages();
        await flushMicrotasks();

        expect(bridgeRequests).toHaveLength(1);
        expect(bridgeRequests[0]).toMatchObject({
            source: 'GeminiNexus',
            type: 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_REQUEST',
            url: GEMINI_ORIGINAL_URL,
        });

        window.dispatchEvent(
            new MessageEvent('message', {
                source: window,
                data: {
                    source: 'GeminiNexus',
                    type: 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_RESPONSE',
                    requestId: bridgeRequests[0].requestId,
                    base64: 'data:image/jpeg;base64,b3JpZ2luYWw=',
                    imageType: 'image/jpeg',
                },
            })
        );
        await flushMicrotasks();

        await vi.waitFor(() => expect(image.src).toBe('blob:processed-1'));
        expect(image.dataset.watermarkRemoved).toBe('true');
        expect(image.dataset.geminiNexusWatermarkRemoved).toBe('true');
        expect(originalFetch).not.toHaveBeenCalledWith(GEMINI_ORIGINAL_URL);
    });

    it('observes image src mutations and debounces page image processing', async () => {
        await installScript();

        expect(mutationObserverCallback).toEqual(expect.any(Function));
        mutationObserverCallback();
        vi.advanceTimersByTime(799);
        expect(bridgeRequests).toEqual([]);

        const image = document.createElement('img');
        image.src = GEMINI_IMAGE_URL;
        document.body.append(image);
        vi.advanceTimersByTime(1);
        await flushMicrotasks();

        expect(bridgeRequests).toHaveLength(1);
    });
});
