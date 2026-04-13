// sandbox/render/pipeline.js
import { MathHandler } from './math_utils.js';
import { escapeHtml, sanitizeHtml } from './sanitize.js';

/**
 * Transforms raw text into sanitized HTML with Math placeholders protected/restored.
 * @param {string} text - Raw Markdown text
 * @returns {string} - Safe HTML string
 */
export function transformMarkdown(text) {
    if (typeof marked === 'undefined') {
        // Library loads asynchronously; return escaped text until markdown support is ready.
        return escapeHtml(text || '');
    }

    const mathHandler = new MathHandler();

    // 1. Protect Math blocks
    let processedText = mathHandler.protect(text || '');

    // 2. Parse Markdown
    let html = marked.parse(processedText);

    // 3. Restore Math blocks
    html = mathHandler.restore(html);

    // 4. Sanitize any raw HTML that came from markdown content
    return sanitizeHtml(html);
}
