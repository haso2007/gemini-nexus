
// sandbox/controllers/message_handler.js
import { appendContextCompressionNotice, appendMessage } from '../render/message.js';
import { cropImage } from '../../lib/crop_utils.js';
import { t } from '../core/i18n.js';
import { WatermarkRemover } from '../../lib/watermark_remover.js';

function hasDisplayableThoughts(thoughts) {
    return typeof thoughts === 'string' ? thoughts.trim().length > 0 : Boolean(thoughts);
}

export class MessageHandler {
    constructor(sessionManager, uiController, imageManager, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        this.app = appController; // Reference back to app for state like captureMode
        this.streamingBubble = null;
        this.contextCompressionNotice = null;
        this.streamStates = new Map();
    }

    async handle(request) {
        // MCP server test result
        if (request.action === "MCP_TEST_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpTestResult === 'function') {
                this.ui.settings.updateMcpTestResult(request);
            }
            return;
        }

        if (request.action === "MCP_TOOLS_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpToolsResult === 'function') {
                this.ui.settings.updateMcpToolsResult(request);
            }
            return;
        }

        // 0. Stream Update
        if (request.action === "GEMINI_STREAM_UPDATE") {
            this.handleStreamUpdate(request);
            return;
        }

        if (request.action === "GEMINI_CONTEXT_STATUS") {
            this.handleContextStatus(request);
            return;
        }

        // 1. AI Reply
        if (request.action === "GEMINI_REPLY") {
            this.handleGeminiReply(request);
            return;
        }

        // 2. Image Fetch Result (For User Uploads)
        if (request.action === "FETCH_IMAGE_RESULT") {
            this.handleImageResult(request);
            return;
        }

        // 2.1 Generated Image Result (Proxy Fetch for Display)
        if (request.action === "GENERATED_IMAGE_RESULT") {
            await this.handleGeneratedImageResult(request);
            return;
        }

        // 3. Capture Result (Crop & OCR)
        if (request.action === "CROP_SCREENSHOT") {
            await this.handleCropResult(request);
            return;
        }

        // 4. Mode Sync (from Context Menu)
        if (request.action === "SET_SIDEBAR_CAPTURE_MODE") {
            this.app.setCaptureMode(request.mode);
            let statusText = t('selectSnip');
            if (request.mode === 'ocr') statusText = t('selectOcr');
            if (request.mode === 'screenshot_translate') statusText = t('selectTranslate');
            
            this.ui.updateStatus(statusText);
            return;
        }

        // 5. Quote Selection Result
        if (request.action === "SELECTION_RESULT") {
            this.handleSelectionResult(request);
            return;
        }

        // 6. Page Context Toggle (from Context Menu)
        if (request.action === "TOGGLE_PAGE_CONTEXT") {
            this.app.setPageContext(request.enable);
            return;
        }
    }

    isCurrentSessionMessage(request) {
        const currentSessionId = this.sessionManager.currentSessionId || null;
        const messageSessionId = request.sessionId || null;
        return currentSessionId !== null && messageSessionId === currentSessionId;
    }

    isGeneratingSessionMessage(request) {
        const generatingSessionId = this.app.generatingSessionId || null;
        const messageSessionId = request.sessionId || null;
        return generatingSessionId !== null && messageSessionId === generatingSessionId;
    }

    hasPersistedAiReply(session, request) {
        if (!session || !Array.isArray(session.messages) || session.messages.length === 0) {
            return false;
        }

        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'ai') return false;

        const expectedText = request.text || "";
        const actualText = lastMessage.text || "";
        const textMatches = expectedText
            ? actualText === expectedText || actualText.startsWith(expectedText)
            : actualText.length > 0;
        if (!textMatches) return false;

        if (request.thoughts) {
            const actualThoughts = lastMessage.thoughts || "";
            return actualThoughts === request.thoughts || actualThoughts.startsWith(request.thoughts);
        }

        return true;
    }

    getRequestSessionId(request) {
        return request?.sessionId || null;
    }

    cacheStreamState(request) {
        const sessionId = this.getRequestSessionId(request);
        if (!sessionId) return null;

        const previous = this.streamStates.get(sessionId) || {};
        const next = {
            ...previous,
            sessionId
        };

        if (request.text !== undefined) {
            next.text = request.text || "";
        }
        if (request.thoughts !== undefined) {
            next.thoughts = request.thoughts || "";
        }
        if (hasDisplayableThoughts(next.thoughts)) {
            if (!Number.isFinite(next.thoughtsStartedAt)) {
                const elapsedSeconds = Number.isFinite(next.thoughtsElapsedSeconds)
                    ? next.thoughtsElapsedSeconds
                    : 0;
                next.thoughtsStartedAt = Date.now() - (elapsedSeconds * 1000);
            }
            next.thoughtsElapsedSeconds = Math.max(0, (Date.now() - next.thoughtsStartedAt) / 1000);
        }
        if (request.contextState !== undefined) {
            next.contextState = request.contextState || null;
        }

        this.streamStates.set(sessionId, next);
        return next;
    }

    clearStreamState(sessionId = null) {
        if (sessionId) {
            this.streamStates.delete(sessionId);
            return;
        }
        this.streamStates.clear();
    }

    createStreamingBubble(state = {}) {
        const bubble = appendMessage(this.ui.historyDiv, "", 'ai', null, "", null, {
            isStreaming: true,
            thoughtsStartedAt: state.thoughtsStartedAt,
            thoughtsElapsedSeconds: state.thoughtsElapsedSeconds
        });

        bubble.update(state.text || "", state.thoughts || "", {
            isStreaming: true,
            thoughtsStartedAt: state.thoughtsStartedAt,
            thoughtsElapsedSeconds: state.thoughtsElapsedSeconds
        });
        this.streamingBubble = bubble;
    }

    handleStreamUpdate(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        const state = this.cacheStreamState(request);

        // Prevent race condition: Ignore stream updates arriving shortly after user cancelled
        if (this.app.prompt.isCancellationRecent()) {
            this.clearStreamState(this.getRequestSessionId(request));
            return;
        }

        if (!this.isCurrentSessionMessage(request)) return;

        // If we don't have a bubble yet, create one
        if (!this.streamingBubble) {
            this.createStreamingBubble(state);
        }
        
        // Update content if text or thoughts exist
        this.streamingBubble.update(request.text, request.thoughts, { isStreaming: true });
        
        // Ensure UI state reflects generation
        if (!this.app.isGenerating) {
            this.app.isGenerating = true;
            this.ui.setLoading(true);
        }
    }

    handleContextStatus(request) {
        if (!this.isGeneratingSessionMessage(request)) return;
        const state = this.cacheStreamState({
            ...request,
            contextState: request.state === 'compressing' ? request.state : null
        });
        if (!this.isCurrentSessionMessage(request)) return;

        if (request.state === 'compressing') {
            if (this.contextCompressionNotice) {
                this.contextCompressionNotice.dispose?.();
            }
            this.contextCompressionNotice = appendContextCompressionNotice(
                this.ui.historyDiv,
                t('contextCompressing')
            );
            return;
        }

        if (!this.contextCompressionNotice) return;

        if (request.state === 'compressed') {
            this.contextCompressionNotice.update(t('contextCompressed'));
            this.contextCompressionNotice = null;
            if (state) state.contextState = null;
            return;
        }

        if (request.state === 'compression_failed') {
            this.contextCompressionNotice.update(t('contextCompressionFallback'));
            this.contextCompressionNotice = null;
            if (state) state.contextState = null;
        }
    }

    handleGeminiReply(request) {
        if (!this.isGeneratingSessionMessage(request)) return;

        this.app.isGenerating = false;
        this.app.generatingSessionId = null;
        this.ui.setLoading(false);
        this.app.sessionFlow.refreshHistoryUI();
        this.clearStreamState(this.getRequestSessionId(request));

        if (!this.isCurrentSessionMessage(request)) {
            this.resetStream();
            return;
        }
        
        const session = this.sessionManager.getCurrentSession();
        if (session) {
            // Note: We do NOT save to sessionManager/storage here anymore.
            // The background script saves the AI response to storage and broadcasts 'SESSIONS_UPDATED'.
            // The AppController handles that broadcast to keep data in sync.
            // We just ensure the UI is visually complete here.

            if (request.status === 'success') {
                // Although session data comes from background, we might want to ensure context matches locally
                // just in case further user prompts happen before SESSIONS_UPDATED arrives (rare)
                this.sessionManager.updateContext(session.id, request.context);
            }

            // Update UI
            if (this.streamingBubble) {
                // Finalize the streaming bubble with complete text and thoughts
                this.streamingBubble.finalize(request.text, request.thoughts, {
                    thoughtsDurationSeconds: request.thoughtsDurationSeconds
                });
                
                // Inject images if any
                if (request.images && request.images.length > 0) {
                    this.streamingBubble.addImages(request.images);
                }

                if (request.sources && request.sources.length > 0) {
                    this.streamingBubble.addSources(request.sources);
                }
                
                if (request.status !== 'success') {
                    // Optionally style error
                }
                
                // Clear reference
                this.streamingBubble = null;
            } else if (!this.hasPersistedAiReply(session, request)) {
                // Fallback if no stream occurred (or single short response)
                appendMessage(this.ui.historyDiv, request.text, 'ai', request.images, request.thoughts, request.sources, {
                    isFinal: true,
                    thoughtsDurationSeconds: request.thoughtsDurationSeconds
                });
            }
        }
    }

    handleImageResult(request) {
        this.ui.updateStatus("");
        if (request.error) {
            console.error("Image fetch failed", request.error);
            this.ui.updateStatus(t('failedLoadImage'));
            setTimeout(() => this.ui.updateStatus(""), 3000);
        } else {
            this.imageManager.setFile(request.base64, request.type, request.name);
        }
    }

    async handleGeneratedImageResult(request) {
        // Find the placeholder image by ID
        const img = document.querySelector(`img[data-req-id="${request.reqId}"]`);
        if (img) {
            if (request.base64) {
                try {
                    // Apply Watermark Removal
                    const cleanedBase64 = await WatermarkRemover.process(request.base64);
                    img.src = cleanedBase64;
                } catch (e) {
                    console.warn("Watermark removal failed, using original", e);
                    img.src = request.base64;
                }
                
                img.classList.remove('loading');
                img.style.minHeight = "auto"; 
            } else {
                // Handle error visually
                img.style.background = "#ffebee"; // Light red
                img.alt = "Failed to load image";
                console.warn("Generated image load failed:", request.error);
            }
        }
    }

    async handleCropResult(request) {
        this.ui.updateStatus(t('processingImage'));
        try {
            const croppedBase64 = await cropImage(request.image, request.area);
            this.imageManager.setFile(croppedBase64, 'image/png', 'snip.png');
            
            if (this.app.captureMode === 'ocr') {
                // Change prompt to localized OCR instructions
                this.ui.inputFn.value = t('ocrPrompt');
                // Auto-send via the main controller
                this.app.handleSendMessage(); 
            } else if (this.app.captureMode === 'screenshot_translate') {
                // Change prompt to localized Translate instructions
                this.ui.inputFn.value = t('screenshotTranslatePrompt');
                this.app.handleSendMessage();
            } else {
                this.ui.updateStatus("");
                this.ui.inputFn.focus();
            }
        } catch (e) {
            console.error("Crop error", e);
            this.ui.updateStatus(t('errorScreenshot'));
        }
    }
    
    handleSelectionResult(request) {
        if (request.text && request.text.trim()) {
             const quote = `> ${request.text.trim()}\n\n`;
             const input = this.ui.inputFn;
             // Append to new line if text exists
             input.value = input.value ? input.value + "\n\n" + quote : quote;
             input.focus();
             // Trigger resize
             input.dispatchEvent(new Event('input'));
        } else {
             this.ui.updateStatus(t('noTextSelected'));
             setTimeout(() => this.ui.updateStatus(""), 2000);
        }
    }

    // Called by AppController on cancel/switch
    resetStream(options = {}) {
        if (this.streamingBubble) {
            if (typeof this.streamingBubble.dispose === 'function') {
                this.streamingBubble.dispose();
            }
            if (options.remove === true && this.streamingBubble.div) {
                this.streamingBubble.div.remove();
            }
            this.streamingBubble = null;
        }
        if (this.contextCompressionNotice && options.remove === true) {
            this.contextCompressionNotice.dispose?.();
        }
        this.contextCompressionNotice = null;
    }

    clearActiveStream() {
        const activeSessionId = this.app.generatingSessionId || this.sessionManager.currentSessionId || null;
        this.clearStreamState(activeSessionId);
        this.resetStream({ remove: true });
    }

    restoreStreamForSession(sessionId) {
        if (!sessionId || sessionId !== this.app.generatingSessionId) return;
        const state = this.streamStates.get(sessionId);
        if (!state) return;
        const session = this.sessionManager.getCurrentSession();
        if (this.hasPersistedAiReply(session, state)) {
            this.clearStreamState(sessionId);
            return;
        }

        this.resetStream();
        if (state.contextState === 'compressing') {
            this.contextCompressionNotice = appendContextCompressionNotice(
                this.ui.historyDiv,
                t('contextCompressing')
            );
        }
        this.createStreamingBubble(state);
        this.ui.setLoading(true);
    }
}
