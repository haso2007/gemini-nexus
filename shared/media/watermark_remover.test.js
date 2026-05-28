// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const INPUT_DATA_URL = 'data:image/png;base64,target-image';

let mockWidth;
let mockHeight;
let samplePixels;
let fillRectCalls;
let drawImageCalls;
let getImageDataCalls;
let toBlobCalls;
let toDataUrlType;
let createdObjectUrls;
let revokedObjectUrls;

function installCanvasMocks() {
    const realCreateElement = document.createElement.bind(document);

    class MockImage {
        set src(value) {
            this._src = value;
            this.width = mockWidth;
            this.height = mockHeight;
            queueMicrotask(() => this.onload?.());
        }

        get src() {
            return this._src;
        }
    }

    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn((blob) => {
            const objectUrl = `blob:mock-${createdObjectUrls.length}`;
            createdObjectUrls.push({ blob, objectUrl });
            return objectUrl;
        }),
        revokeObjectURL: vi.fn((objectUrl) => {
            revokedObjectUrls.push(objectUrl);
        }),
    });

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName !== 'canvas') {
            return realCreateElement(tagName);
        }

        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => context),
            toDataURL: vi.fn((type) => {
                toDataUrlType = type;
                return 'data:image/png;base64,processed';
            }),
            toBlob: vi.fn((callback, type, quality) => {
                toBlobCalls.push({ type, quality });
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
            getImageData: vi.fn((x, y, width, height) => {
                getImageDataCalls.push([x, y, width, height]);
                return {
                    width,
                    height,
                    data: new Uint8ClampedArray(samplePixels),
                };
            }),
        };

        return canvas;
    });
}

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

describe('WatermarkRemover', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        delete globalThis.GeminiNexusWatermarkRemover;

        mockWidth = 1200;
        mockHeight = 900;
        samplePixels = makeSamplePixels([16, 32, 48]);
        fillRectCalls = [];
        drawImageCalls = [];
        getImageDataCalls = [];
        toBlobCalls = [];
        toDataUrlType = null;
        createdObjectUrls = [];
        revokedObjectUrls = [];
        installCanvasMocks();
    });

    it('covers the small Gemini watermark box with a sampled background color', async () => {
        const { WatermarkRemover } = await import('./watermark_remover.js');

        const result = await WatermarkRemover.process(INPUT_DATA_URL);

        expect(result).toBe('data:image/png;base64,processed');
        expect(getImageDataCalls).toEqual([[1116, 806, 5, 5]]);
        expect(fillRectCalls).toEqual([
            {
                args: [1116, 816, 56, 56],
                fillStyle: 'rgb(16, 32, 48)',
            },
        ]);
        expect(drawImageCalls[0]).toEqual([expect.any(Object), 0, 0]);
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
        expect(toDataUrlType).toBe('image/png');
    });

    it('uses the large Gemini watermark box when both image dimensions exceed 1024', async () => {
        mockWidth = 1536;
        mockHeight = 1536;
        const { WatermarkRemover } = await import('./watermark_remover.js');

        await WatermarkRemover.process(INPUT_DATA_URL);

        expect(getImageDataCalls).toEqual([[1372, 1362, 5, 5]]);
        expect(fillRectCalls).toEqual([
            {
                args: [1372, 1372, 104, 104],
                fillStyle: 'rgb(16, 32, 48)',
            },
        ]);
        expect(drawImageCalls[1]).toEqual([
            expect.any(Object),
            1268,
            1372,
            104,
            104,
            1372,
            1372,
            104,
            104,
        ]);
    });

    it('keeps 1024px square images on the small watermark rule', async () => {
        mockWidth = 1024;
        mockHeight = 1024;
        const { WatermarkRemover } = await import('./watermark_remover.js');

        await WatermarkRemover.process(INPUT_DATA_URL);

        expect(fillRectCalls[0]).toEqual({
            args: [940, 940, 56, 56],
            fillStyle: 'rgb(16, 32, 48)',
        });
    });

    it('processes blobs with object URL cleanup and jpeg export quality', async () => {
        const inputBlob = new Blob(['original'], { type: 'image/webp' });
        const { WatermarkRemover } = await import('./watermark_remover.js');

        const result = await WatermarkRemover.processBlob(inputBlob);

        expect(result).toBeInstanceOf(Blob);
        expect(result.type).toBe('image/webp');
        expect(createdObjectUrls).toEqual([{ blob: inputBlob, objectUrl: 'blob:mock-0' }]);
        expect(revokedObjectUrls).toEqual(['blob:mock-0']);
        expect(toBlobCalls).toEqual([{ type: 'image/webp', quality: 0.95 }]);
    });
});
