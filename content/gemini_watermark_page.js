(function () {
    const MESSAGE_SOURCE = 'GeminiNexus';
    const SETTINGS_MESSAGE_TYPE = 'GEMINI_NEXUS_WATERMARK_REMOVAL_ENABLED';
    const FETCH_REQUEST_TYPE = 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_REQUEST';
    const FETCH_RESPONSE_TYPE = 'GEMINI_NEXUS_FETCH_GEMINI_IMAGE_RESPONSE';
    const GEMINI_IMAGE_PATTERN =
        /^https:\/\/lh3\.googleusercontent\.com\/(?:rd-)?gg(?:-dl)?\/.+=s.*/;
    const SMALL_WATERMARK_SIZE = 48;
    const SMALL_WATERMARK_MARGIN = 32;
    const LARGE_WATERMARK_SIZE = 96;
    const LARGE_WATERMARK_MARGIN = 64;
    const PADDING = 4;
    const SAMPLE_SIZE = 5;
    const SAMPLE_OFFSET_Y = 10;
    const EXPORT_QUALITY = 0.95;
    const DOM_SCAN_DELAY_MS = 800;
    const INITIAL_SCAN_DELAY_MS = 1500;

    if (window.GeminiNexusWatermarkPage?.installed) return;

    const state = {
        enabled: true,
        processedImages: new WeakSet(),
        scanTimer: null,
        objectUrls: new WeakMap(),
        pendingFetches: new Map(),
        nextFetchId: 1,
        originalFetch: window.fetch.bind(window),
    };

    function getWatermarkBox(width, height) {
        if (width > 1024 && height > 1024) {
            return { size: LARGE_WATERMARK_SIZE, margin: LARGE_WATERMARK_MARGIN };
        }

        return { size: SMALL_WATERMARK_SIZE, margin: SMALL_WATERMARK_MARGIN };
    }

    function replaceWithNormalSize(src) {
        return src.replace(/=s\d+(?=[-?#]|$)/, '=s0');
    }

    function getRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.href;
        return input?.url || '';
    }

    function replaceFetchInput(input, url) {
        if (typeof input === 'string' || input instanceof URL) return url;
        if (typeof Request === 'function' && input instanceof Request) {
            return new Request(url, input);
        }
        return input;
    }

    function dataUrlToBlob(dataUrl) {
        const [header, encodedData = ''] = dataUrl.split(',');
        const mimeMatch = header.match(/^data:([^;]+);base64$/);
        const mimeType = mimeMatch?.[1] || 'image/png';
        const binary = atob(encodedData);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return new Blob([bytes], { type: mimeType });
    }

    function fetchViaExtensionBridge(url) {
        return new Promise((resolve, reject) => {
            const requestId = `gemini-watermark-${Date.now()}-${state.nextFetchId++}`;
            const timeout = setTimeout(() => {
                state.pendingFetches.delete(requestId);
                reject(new Error('Gemini image bridge request timed out'));
            }, 10000);

            state.pendingFetches.set(requestId, { resolve, reject, timeout });
            window.postMessage(
                {
                    source: MESSAGE_SOURCE,
                    type: FETCH_REQUEST_TYPE,
                    requestId,
                    url,
                },
                '*'
            );
        });
    }

    async function fetchImageBlob(url) {
        try {
            return await fetchViaExtensionBridge(url);
        } catch {}

        const response = await state.originalFetch(url);
        if (!isImageResponse(response)) {
            throw new Error(`Image request failed: ${response.status}`);
        }
        return await response.blob();
    }

    function loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(blob);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image into canvas'));
            };
            image.src = objectUrl;
        });
    }

    function averageSampleColor(context, x, y) {
        const imageData = context.getImageData(x, y, SAMPLE_SIZE, SAMPLE_SIZE);
        const data = imageData.data;
        const count = data.length / 4 || 1;
        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;

        for (let colorIndex = 0; colorIndex < data.length; colorIndex += 4) {
            redTotal += data[colorIndex];
            greenTotal += data[colorIndex + 1];
            blueTotal += data[colorIndex + 2];
        }

        return {
            red: Math.floor(redTotal / count),
            green: Math.floor(greenTotal / count),
            blue: Math.floor(blueTotal / count),
        };
    }

    function coverWatermark(context, canvas, width, height) {
        const { size, margin } = getWatermarkBox(width, height);
        const watermarkX = width - margin - size;
        const watermarkY = height - margin - size;
        const fillX = Math.max(0, watermarkX - PADDING);
        const fillY = Math.max(0, watermarkY - PADDING);
        const fillW = Math.min(width - fillX, size + PADDING * 2);
        const fillH = Math.min(height - fillY, size + PADDING * 2);
        if (fillW <= 0 || fillH <= 0) return;

        const sampleY = Math.max(0, fillY - SAMPLE_OFFSET_Y);
        const sampleX = Math.min(fillX, Math.max(0, width - SAMPLE_SIZE));
        const { red, green, blue } = averageSampleColor(context, sampleX, sampleY);

        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillRect(fillX, fillY, fillW, fillH);

        if (fillX > fillW) {
            context.drawImage(
                canvas,
                fillX - fillW,
                fillY,
                fillW,
                fillH,
                fillX,
                fillY,
                fillW,
                fillH
            );
        }
    }

    async function removeWatermark(blob) {
        const image = await loadImageFromBlob(blob);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || !image.width || !image.height) return blob;

        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        coverWatermark(context, canvas, image.width, image.height);

        return await new Promise((resolve, reject) => {
            canvas.toBlob(
                (processedBlob) => {
                    if (processedBlob) resolve(processedBlob);
                    else reject(new Error('Canvas toBlob failed'));
                },
                blob.type || 'image/jpeg',
                EXPORT_QUALITY
            );
        });
    }

    function isImageResponse(response) {
        return response.ok && response.headers.get('content-type')?.includes('image');
    }

    window.fetch = async function (...args) {
        const url = getRequestUrl(args[0]);
        if (!state.enabled || !url || !GEMINI_IMAGE_PATTERN.test(url)) {
            return state.originalFetch(...args);
        }

        const normalSizeUrl = replaceWithNormalSize(url);
        const nextArgs = [...args];
        nextArgs[0] = replaceFetchInput(nextArgs[0], normalSizeUrl);

        try {
            const response = await state.originalFetch(...nextArgs);
            if (!isImageResponse(response)) return response;

            const originalBlob = await response.clone().blob();
            const processedBlob = await removeWatermark(originalBlob);
            return new Response(processedBlob, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        } catch (error) {
            console.warn('[Gemini Nexus] Gemini watermark fetch cleanup failed:', error);
            return state.originalFetch(...args);
        }
    };

    function replaceImageSource(image, objectUrl) {
        const previousObjectUrl = state.objectUrls.get(image);
        if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);

        state.objectUrls.set(image, objectUrl);
        image.src = objectUrl;
        image.dataset.watermarkRemoved = 'true';
        image.dataset.geminiNexusWatermarkRemoved = 'true';
    }

    async function processPageImage(image) {
        if (!state.enabled || state.processedImages.has(image)) return;

        const src = image.currentSrc || image.src || '';
        if (!GEMINI_IMAGE_PATTERN.test(src)) return;

        state.processedImages.add(image);
        try {
            const processedBlob = await removeWatermark(
                await fetchImageBlob(replaceWithNormalSize(src))
            );
            replaceImageSource(image, URL.createObjectURL(processedBlob));
        } catch (error) {
            state.processedImages.delete(image);
            console.warn('[Gemini Nexus] Gemini page image cleanup failed:', error);
        }
    }

    function processPageImages() {
        if (!state.enabled) return;
        const images = document.querySelectorAll('img[src^="https://lh3.googleusercontent.com"]');
        for (const image of images) {
            processPageImage(image);
        }
    }

    function schedulePageImageProcessing() {
        if (state.scanTimer) clearTimeout(state.scanTimer);
        state.scanTimer = setTimeout(processPageImages, DOM_SCAN_DELAY_MS);
    }

    function applyEnabled(enabled) {
        state.enabled = enabled !== false;
        if (state.enabled) schedulePageImageProcessing();
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const data = event.data || {};
        if (data.source !== MESSAGE_SOURCE) return;

        if (data.type === SETTINGS_MESSAGE_TYPE) {
            applyEnabled(data.enabled);
            return;
        }

        if (data.type === FETCH_RESPONSE_TYPE) {
            const pendingFetch = state.pendingFetches.get(data.requestId);
            if (!pendingFetch) return;

            clearTimeout(pendingFetch.timeout);
            state.pendingFetches.delete(data.requestId);

            if (data.error || !data.base64) {
                pendingFetch.reject(new Error(data.error || 'Gemini image bridge request failed'));
                return;
            }

            pendingFetch.resolve(dataUrlToBlob(data.base64));
        }
    });

    function observeDocument() {
        if (!document.body) {
            setTimeout(observeDocument, 100);
            return;
        }

        new MutationObserver(schedulePageImageProcessing).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'srcset'],
        });
        setTimeout(processPageImages, INITIAL_SCAN_DELAY_MS);
    }

    observeDocument();

    window.GeminiNexusWatermarkPage = {
        installed: true,
        setEnabled: applyEnabled,
        processPageImages,
    };
})();
