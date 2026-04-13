/**
 * Handles rendering results in the toolbar window.
 */
export class UIRenderer {
    constructor(view, bridge) {
        this.view = view;
        this.bridge = bridge;
        this.currentResultText = '';
    }

    async show(text, title, isStreaming, images = []) {
        this.currentResultText = text;

        let html = text;
        let tasks = [];

        if (this.bridge) {
            try {
                const result = await this.bridge.render(text, isStreaming ? [] : images);
                html = result.html;
                tasks = result.fetchTasks || [];
            } catch (e) {
                console.warn("Bridge render failed, falling back to simple escape");
                html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            }
        }

        this.view.showResult(html, title, isStreaming);

        if (tasks.length > 0) {
            this._executeImageFetchTasks(tasks);
        }
    }

    _executeImageFetchTasks(tasks) {
        const container = this.view.elements.resultText;
        if (!container) return;

        tasks.forEach((task) => {
            const img = container.querySelector(`img[data-req-id="${task.reqId}"]`);
            if (img) {
                chrome.runtime.sendMessage({
                    action: "FETCH_GENERATED_IMAGE",
                    url: task.url,
                    reqId: task.reqId
                });
            }
        });
    }

    handleGeneratedImageResult(request) {
        const container = this.view.elements.resultText;
        if (!container) return;

        const img = container.querySelector(`img[data-req-id="${request.reqId}"]`);
        if (!img) return;

        if (request.base64) {
            img.src = request.base64;
            img.classList.remove('loading');
            img.style.minHeight = "auto";
            return;
        }

        img.style.background = "#ffebee";
        img.alt = "Failed to load";
    }

    get currentText() {
        return this.currentResultText;
    }
}
