import { SelectionObserver } from '../selection.js';
import { ToolbarActions } from './actions.js';
import { imageCropper } from './crop.js';
import { ToolbarDispatcher } from './dispatch.js';
import { GeminiImageDetector } from './image.js';
import { GeminiStreamHandler } from './stream.js';
import { ToolbarUI } from './ui/manager.js';
import { InputManager } from './utils/input.js';

export class ToolbarController {
    constructor(deps = {}) {
        const {
            ToolbarUIClass = ToolbarUI,
            ToolbarActionsClass = ToolbarActions,
            ImageDetectorClass = GeminiImageDetector,
            StreamHandlerClass = GeminiStreamHandler,
            InputManagerClass = InputManager,
            ToolbarDispatcherClass = ToolbarDispatcher,
            SelectionObserverClass = SelectionObserver,
            imageCropperImpl = imageCropper,
        } = deps;

        this.ToolbarUIClass = ToolbarUIClass;
        this.ToolbarActionsClass = ToolbarActionsClass;
        this.ImageDetectorClass = ImageDetectorClass;
        this.StreamHandlerClass = StreamHandlerClass;
        this.InputManagerClass = InputManagerClass;
        this.ToolbarDispatcherClass = ToolbarDispatcherClass;
        this.SelectionObserverClass = SelectionObserverClass;
        this.imageCropper = imageCropperImpl;

        this.ui = new this.ToolbarUIClass();
        this.actions = new this.ToolbarActionsClass(this.ui);

        this.imageDetector = new this.ImageDetectorClass({
            onShow: (rect) => this.ui.showImageButton(rect),
            onHide: () => this.ui.hideImageButton()
        });

        this.streamHandler = new this.StreamHandlerClass(this.ui, {
            onSessionId: (id) => { this.lastSessionId = id; }
        });

        this.inputManager = new this.InputManagerClass();
        this.dispatcher = new this.ToolbarDispatcherClass(this);
        this.selectionObserver = new this.SelectionObserverClass({
            onSelection: this.handleSelection.bind(this),
            onClear: this.handleSelectionClear.bind(this),
            onClick: this.handleClick.bind(this)
        });

        this.visible = false;
        this.currentSelection = "";
        this.lastRect = null;
        this.lastMousePoint = null;
        this.lastSessionId = null;
        this.currentMode = 'ask';
        this.isSelectionEnabled = true;

        this.handleAction = this.handleAction.bind(this);

        this.init();
    }

    init() {
        this.ui.build();
        this.ui.setCallbacks({
            onAction: this.handleAction,
            onModelChange: (model) => this.handleModelChange(model),
            onImageBtnHover: (isHovering) => {
                if (isHovering) {
                    this.imageDetector.cancelHide();
                } else {
                    this.imageDetector.scheduleHide();
                }
            }
        });

        this.syncSettings();

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                const keys = ['geminiModel', 'geminiProvider', 'geminiUseOfficialApi', 'geminiOpenaiModel'];
                if (keys.some((key) => changes[key])) {
                    this.syncSettings();
                }
            }
        });

        this.imageDetector.init();
        this.streamHandler.init();
    }

    async syncSettings() {
        const result = await chrome.storage.local.get([
            'geminiModel',
            'geminiProvider',
            'geminiUseOfficialApi',
            'geminiOpenaiModel'
        ]);

        const settings = {
            provider: result.geminiProvider || (result.geminiUseOfficialApi ? 'official' : 'web'),
            openaiModel: result.geminiOpenaiModel
        };

        this.ui.updateModelList(settings, result.geminiModel);
    }

    setSelectionEnabled(enabled) {
        this.isSelectionEnabled = enabled;
        if (!enabled) {
            this.handleSelectionClear();
        }
    }

    setImageToolsEnabled(enabled) {
        this.imageDetector.setEnabled(enabled);
    }

    handleContextAction(mode) {
        this.currentMode = mode;

        if (mode === 'ask') {
            this.showGlobalInput(false);
        } else if (mode === 'page_chat') {
            this.showGlobalInput(true);
        } else {
            chrome.runtime.sendMessage({ action: "INITIATE_CAPTURE" });
        }
    }

    async handleCropResult(request) {
        const rect = {
            left: window.innerWidth / 2 - 200,
            top: 100,
            right: window.innerWidth / 2 + 200,
            bottom: 200,
            width: 400,
            height: 100
        };

        const model = this.ui.getSelectedModel();

        let finalImage = request.image;
        if (this.imageCropper && request.area) {
            try {
                finalImage = await this.imageCropper.crop(request.image, request.area);
            } catch (e) {
                console.error("Crop failed in content script", e);
            }
        }

        if (this.currentMode === 'ocr') {
            this.actions.handleImagePrompt(finalImage, rect, 'ocr', model);
        } else if (this.currentMode === 'screenshot_translate') {
            this.actions.handleImagePrompt(finalImage, rect, 'translate', model);
        } else if (this.currentMode === 'snip') {
            this.actions.handleImagePrompt(finalImage, rect, 'snip', model);
        }

        this.currentMode = 'ask';
        this.visible = true;
    }

    handleGeneratedImageResult(request) {
        if (request.base64 && this.ui) {
            this.ui.processImage(request.base64).then((cleaned) => {
                this.ui.handleGeneratedImageResult({ ...request, base64: cleaned });
            }).catch(() => {
                this.ui.handleGeneratedImageResult(request);
            });
            return;
        }
        this.ui.handleGeneratedImageResult(request);
    }

    handleClick(e) {
        if (this.ui.isHost(e.target)) return;

        if (this.ui.isPinned || this.ui.isDocked) {
            if (this.visible && !this.ui.isWindowVisible()) {
                this.hide();
            }
            return;
        }

        this.hide();
    }

    handleSelection(data) {
        if (!this.isSelectionEnabled) return;

        const { text, rect, mousePoint } = data;
        this.currentSelection = text;
        this.lastRect = rect;
        this.lastMousePoint = mousePoint;

        this.inputManager.capture();
        this.ui.showGrammarButton(this.inputManager.hasSource());
        this.show(rect, mousePoint);
    }

    handleSelectionClear() {
        if (!this.ui.isWindowVisible()) {
            this.currentSelection = "";
            this.inputManager.reset();
            this.hide();
        }
    }

    handleModelChange(model) {
        chrome.storage.local.set({ 'geminiModel': model });
    }

    handleAction(actionType, data) {
        this.dispatcher.dispatch(actionType, data);
    }

    show(rect, mousePoint) {
        this.lastRect = rect;
        this.ui.show(rect, mousePoint);
        this.visible = true;
    }

    hide() {
        if (this.ui.isWindowVisible()) return;
        if (!this.visible) return;
        this.ui.hide();
        this.visible = false;
    }

    hideAll() {
        this.ui.hideAll();
        this.visible = false;
    }

    showGlobalInput(withPageContext = false) {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const width = 400;
        const height = 100;

        const left = (viewportW - width) / 2;
        const top = (viewportH / 2) - 200;

        const rect = {
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height
        };

        this.ui.hide();
        const isZh = navigator.language.startsWith('zh');

        let title = isZh ? "询问" : "Ask Gemini";
        if (withPageContext) {
            title = isZh ? "与当前网页对话" : "Chat with Page";
        }

        this.ui.showAskWindow(rect, null, title);
        this.ui.setInputValue("");
        this.currentSelection = "";
        this.lastSessionId = null;
        this.visible = true;

        if (withPageContext) {
            this.currentSelection = "__PAGE_CONTEXT_FORCE__";
        }
    }
}
