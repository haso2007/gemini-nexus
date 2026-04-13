import { RendererBridge } from '../bridge.js';
import { ToolbarEvents } from '../events.js';
import { DragController } from '../utils/drag.js';
import { ToolbarDOM } from '../view/dom.js';
import { ToolbarView } from '../view/index.js';
import { ToolbarUIActions } from './actions_delegate.js';
import { CodeCopyHandler } from './code_copy.js';
import { GeminiUIGrammar } from './grammar.js';
import { UIRenderer } from './renderer.js';

const isZh = navigator.language.startsWith('zh');
const DEFAULT_TITLE = isZh ? "询问" : "Ask";

/**
 * Main UI Manager.
 */
export class ToolbarUI {
    constructor() {
        this.host = null;
        this.shadow = null;
        this.view = null;
        this.dragController = null;
        this.events = null;
        this.domBuilder = new ToolbarDOM();
        this.callbacks = {};
        this.isBuilt = false;

        this.grammarManager = null;
        this.bridge = null;
        this.renderer = null;
        this.actionsDelegate = null;
        this.codeCopyHandler = null;
    }

    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }

    build() {
        if (this.isBuilt) return;

        const { host, shadow } = this.domBuilder.create();
        this.host = host;
        this.shadow = shadow;

        this.view = new ToolbarView(this.shadow);
        this.grammarManager = new GeminiUIGrammar(this.view);

        this.bridge = new RendererBridge(this.host);
        this.renderer = new UIRenderer(this.view, this.bridge);
        this.actionsDelegate = new ToolbarUIActions(this);
        this.codeCopyHandler = new CodeCopyHandler();

        this.dragController = new DragController(
            this.view.elements.askWindow,
            this.view.elements.askHeader,
            {
                onSnap: (side, top) => this.view.dockWindow(side, top),
                onUndock: () => this.view.undockWindow()
            }
        );

        this.toolbarDragController = new DragController(
            this.view.elements.toolbar,
            this.view.elements.toolbarDrag,
            {}
        );

        this.events = new ToolbarEvents(this);
        this.events.bind(this.view.elements, this.view.elements.askWindow);

        this.isBuilt = true;
    }

    get actions() {
        return this.actionsDelegate;
    }

    get codeCopy() {
        return this.codeCopyHandler;
    }

    handleImageClick() {
        this.fireCallback('onAction', 'image_analyze');
    }

    handleImageHover(isHovering) {
        this.fireCallback('onImageBtnHover', isHovering);
    }

    handleModelChange(model) {
        this.fireCallback('onModelChange', model);
    }

    saveWindowDimensions(w, h) {
        chrome.storage.local.set({ 'gemini_nexus_window_size': { w, h } });
    }

    fireCallback(type, ...args) {
        if (type === 'onImageBtnHover' && this.callbacks.onImageBtnHover) {
            this.callbacks.onImageBtnHover(...args);
        } else if (type === 'onModelChange' && this.callbacks.onModelChange) {
            this.callbacks.onModelChange(...args);
        } else if (this.callbacks.onAction) {
            this.callbacks.onAction(...args);
        }
    }

    show(rect, mousePoint) {
        this.view.showToolbar(rect, mousePoint);
    }

    hide() {
        this.view.hideToolbar();
    }

    hideAll() {
        this.hide();
        this.hideAskWindow();
        this.hideImageButton();
    }

    showImageButton(rect) {
        this.view.showImageButton(rect);
    }

    hideImageButton() {
        this.view.hideImageButton();
    }

    showAskWindow(rect, contextText, title = DEFAULT_TITLE, mousePoint = null) {
        return this.view.showAskWindow(rect, contextText, title, () => this.dragController.reset(), mousePoint);
    }

    showLoading(msg) {
        this.view.showLoading(msg);
    }

    stopLoading() {
        this.view.updateStreamingState(false);
        if (this.grammarManager) {
            this.grammarManager.updateResultActions(false);
        }
    }

    async showResult(text, title, isStreaming, images = []) {
        if (this.renderer) {
            await this.renderer.show(text, title, isStreaming, images);
        }

        if (this.grammarManager) {
            this.grammarManager.updateResultActions(isStreaming);
        }
    }

    handleGeneratedImageResult(request) {
        if (this.renderer) {
            this.renderer.handleGeneratedImageResult(request);
        }
    }

    async processImage(base64) {
        if (this.bridge) {
            return this.bridge.processImage(base64);
        }
        return base64;
    }

    showError(text, meta = null) {
        this.view.showError(text, meta);
    }

    hideAskWindow() {
        this.view.hideAskWindow();
        this.resetGrammarMode();
    }

    setInputValue(text) {
        this.view.setInputValue(text);
    }

    getSelectedModel() {
        return this.view ? this.view.getSelectedModel() : "gemini-2.5-flash";
    }

    setSelectedModel(model) {
        if (this.view) {
            this.view.setSelectedModel(model);
        }
    }

    updateModelList(settings, currentModel) {
        const provider = settings.provider || 'web';
        let opts = [];

        if (provider === 'official') {
            opts = [
                { val: 'gemini-3-flash-preview', txt: 'Gemini 3 Flash' },
                { val: 'gemini-3-pro-preview', txt: 'Gemini 3 Pro' }
            ];
        } else if (provider === 'openai') {
            const rawModels = settings.openaiModel || "";
            const models = rawModels.split(',').map((m) => m.trim()).filter((m) => m);
            if (models.length === 0) {
                opts = [{ val: 'openai_custom', txt: 'Custom Model' }];
            } else {
                opts = models.map((m) => ({ val: m, txt: m }));
            }
        } else {
            opts = [
                { val: 'gemini-3-flash', txt: 'Fast' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro' }
            ];
        }

        this.view.updateModelOptions(opts, currentModel);
    }

    setGrammarMode(enabled, sourceElement = null, selectionRange = null) {
        if (this.grammarManager) {
            this.grammarManager.setMode(enabled, sourceElement, selectionRange);
        }
    }

    resetGrammarMode() {
        if (this.grammarManager) {
            this.grammarManager.reset();
        }
    }

    showInsertReplaceButtons(show) {
        if (this.grammarManager) {
            this.grammarManager.toggleButtons(show);
        }
    }

    getSourceInfo() {
        return this.grammarManager ? this.grammarManager.getSourceInfo() : { element: null, range: null };
    }

    showGrammarButton(show) {
        if (this.grammarManager) {
            this.grammarManager.showTriggerButton(show);
        }
    }

    showCopySelectionFeedback(success) {
        this.view.toggleCopySelectionIcon(success);
        setTimeout(() => {
            this.view.toggleCopySelectionIcon(null);
        }, 2000);
    }

    isVisible() {
        if (!this.view) return false;
        return this.view.isToolbarVisible() || this.view.isWindowVisible();
    }

    isWindowVisible() {
        if (!this.view) return false;
        return this.view.isWindowVisible();
    }

    isHost(target) {
        if (!this.view) return false;
        return this.view.isHost(target, this.host);
    }
}
