import { toolbarIcons } from '../icons.js';
import { viewUtils } from './utils.js';

/**
 * Sub-controller for floating toolbar and image button.
 */
export class WidgetView {
    constructor(elements) {
        this.elements = elements;
    }

    showToolbar(rect, mousePoint) {
        if (!this.elements.toolbar) return;
        viewUtils.positionElement(this.elements.toolbar, rect, false, false, mousePoint);
        this.elements.toolbar.classList.add('visible');
    }

    hideToolbar() {
        if (this.elements.toolbar) this.elements.toolbar.classList.remove('visible');
    }

    showImageButton(rect) {
        if (!this.elements.imageBtn) return;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const left = rect.left + scrollX + 10;
        const top = rect.top + scrollY + 10;

        Object.assign(this.elements.imageBtn.style, { left: `${left}px`, top: `${top}px` });
        this.elements.imageBtn.classList.add('visible');
    }

    hideImageButton() {
        if (this.elements.imageBtn) this.elements.imageBtn.classList.remove('visible');
    }

    isToolbarVisible() {
        return this.elements.toolbar && this.elements.toolbar.classList.contains('visible');
    }

    toggleCopySelectionIcon(success) {
        const btn = this.elements.buttons.copySelection;
        if (!btn) return;
        btn.innerHTML = success === true ? toolbarIcons.CHECK : toolbarIcons.COPY;
    }
}
