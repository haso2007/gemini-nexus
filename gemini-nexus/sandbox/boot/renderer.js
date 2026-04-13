// sandbox/boot/renderer.js
import { loadLibs } from './loader.js';
import { transformMarkdown } from '../render/pipeline.js';
import { WatermarkRemover } from '../../lib/watermark_remover.js';
import { getHighResImageUrl } from '../../lib/utils.js';
import { escapeAttribute, escapeHtml } from '../render/sanitize.js';
import { getOriginFromUrl, isTrustedRendererRequest } from '../../lib/message_security.js';

export function initRendererMode() {
    document.body.innerHTML = ''; // Clear UI

    // Load libs immediately
    loadLibs();
    const parentOrigin = getOriginFromUrl(document.referrer) || window.location.origin;
    let activeBridgeToken = null;

    window.addEventListener('message', async (e) => {
        if (e.data.action === 'INIT_BRIDGE') {
            if (!isTrustedRendererRequest(e, window.parent, parentOrigin, null)) {
                return;
            }

            activeBridgeToken = e.data.bridgeToken;
            return;
        }

        if (!isTrustedRendererRequest(e, window.parent, parentOrigin, activeBridgeToken)) {
            return;
        }

        // 1. Text & Image Rendering (Unified)
        if (e.data.action === 'RENDER') {
            const { text, reqId, images, bridgeToken } = e.data;

            try {
                // Use shared pipeline
                let html = transformMarkdown(text);

                // Process KaTeX if available
                if (typeof katex !== 'undefined') {
                    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (m, c) => {
                        try { return katex.renderToString(c, { displayMode: true, throwOnError: false }); } catch(err){ return m; }
                    });
                    html = html.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$/g, (m, c) => {
                         try { return katex.renderToString(c, { displayMode: false, throwOnError: false }); } catch(err){ return m; }
                    });
                }

                // Process Generated Images (if passed from content script)
                const fetchTasks = [];
                if (images && Array.isArray(images) && images.length > 0) {
                    let imageHtml = '<div class="generated-images-grid">';
                    // Only display the first generated image for floating UI
                    const displayImages = [images[0]];

                    displayImages.forEach(imgData => {
                        const imgReqId = 'gen_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        const targetUrl = getHighResImageUrl(imgData.url);
                        const safeAlt = escapeAttribute(imgData.alt || 'Generated Image');

                        imageHtml += `<img class="generated-image loading" alt="${safeAlt}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjwvc3ZnPg==" data-req-id="${imgReqId}">`;

                        fetchTasks.push({ reqId: imgReqId, url: targetUrl });
                    });
                    imageHtml += '</div>';
                    html += imageHtml;
                }

                e.source.postMessage({ action: 'RENDER_RESULT', html: html, reqId, fetchTasks, bridgeToken }, e.origin || '*');
            } catch (err) {
                console.error('Render error', err);
                e.source.postMessage({ action: 'RENDER_RESULT', html: escapeHtml(text || ''), reqId, bridgeToken }, e.origin || '*');
            }
        }

        // 2. Image Processing (Watermark Removal)
        if (e.data.action === 'PROCESS_IMAGE') {
            const { base64, reqId, bridgeToken } = e.data;
            try {
                const result = await WatermarkRemover.process(base64);
                e.source.postMessage({ action: 'PROCESS_IMAGE_RESULT', base64: result, reqId, bridgeToken }, e.origin || '*');
            } catch (err) {
                console.warn('Watermark removal failed in renderer', err);
                e.source.postMessage({ action: 'PROCESS_IMAGE_RESULT', base64: base64, reqId, error: err.message, bridgeToken }, e.origin || '*');
            }
        }
    });
}
