
// background/handlers/ui.js
import { UIImageActions } from './ui_image_actions.js';
import { UIMcpActions } from './ui_mcp_actions.js';
import { UIPanelActions } from './ui_panel_actions.js';

export class UIMessageHandler {
    constructor(imageHandler, controlManager, mcpManager) {
        this.imageHandler = imageHandler;
        this.controlManager = controlManager;
        this.mcpManager = mcpManager;
        this.imageActions = new UIImageActions(imageHandler);
        this.mcpActions = new UIMcpActions(mcpManager);
        this.panelActions = new UIPanelActions(controlManager);
    }

    handle(request, sender, sendResponse) {
        if (request.action === "FETCH_IMAGE") {
            return this.imageActions.fetchImage(request, sendResponse);
        }

        if (request.action === "FETCH_GENERATED_IMAGE") {
            return this.imageActions.fetchGeneratedImage(request, sender, sendResponse);
        }

        if (request.action === "CAPTURE_SCREENSHOT") {
            return this.imageActions.captureScreenshot(sender, sendResponse);
        }

        if (request.action === "OPEN_SIDE_PANEL") {
            this.panelActions.openSidePanel(request, sender).finally(() => {
                 sendResponse({ status: "opened" });
            });
            return true; 
        }

        if (request.action === "TOGGLE_SIDE_PANEL_CONTROL") {
            this.panelActions.toggleSidePanelControl(request, sender).finally(() => {
                 sendResponse({ status: "processed" });
            });
            return true;
        }

        if (request.action === "INITIATE_CAPTURE") {
            return this.imageActions.initiateCapture(request);
        }

        if (request.action === "AREA_SELECTED") {
            return this.imageActions.areaSelected(request, sender, sendResponse);
        }

        if (request.action === "PROCESS_CROP_IN_SIDEPANEL") {
            return this.imageActions.processCropInSidepanel(request, sendResponse);
        }

        if (request.action === "GET_ACTIVE_SELECTION") {
            return this.imageActions.getActiveSelection(sendResponse);
        }

        if (request.action === "CHECK_PAGE_CONTEXT") {
            return this.imageActions.checkPageContext(sendResponse);
        }

        if (request.action === "MCP_TEST_CONNECTION") {
            this.mcpActions.testConnection(request, sendResponse);
            return true;
        }

        if (request.action === "MCP_LIST_TOOLS") {
            this.mcpActions.listTools(request, sendResponse);
            return true;
        }

        if (request.action === "GET_OPEN_TABS") {
            return this.panelActions.getOpenTabs(sendResponse);
        }
        
        if (request.action === "SWITCH_TAB") {
            return this.panelActions.switchTab(request, sendResponse);
        }

        if (request.action === "TOGGLE_BROWSER_CONTROL") {
            return this.panelActions.toggleBrowserControl(request, sendResponse);
        }

        return false;
    }
}
