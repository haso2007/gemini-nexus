/**
 * Manages grammar correction mode state and UI.
 */
export class GeminiUIGrammar {
    constructor(view) {
        this.view = view;
        this.isGrammarMode = false;
        this.sourceInputElement = null;
        this.sourceSelectionRange = null;
    }

    setMode(enabled, sourceElement = null, selectionRange = null) {
        this.isGrammarMode = enabled;
        this.sourceInputElement = sourceElement;
        this.sourceSelectionRange = selectionRange;
    }

    reset() {
        this.isGrammarMode = false;
        this.sourceInputElement = null;
        this.sourceSelectionRange = null;
        this.toggleButtons(false);
    }

    getSourceInfo() {
        return {
            element: this.sourceInputElement,
            range: this.sourceSelectionRange
        };
    }

    showTriggerButton(show) {
        const { buttons } = this.view.elements;
        if (buttons.grammar) {
            buttons.grammar.classList.toggle('hidden', !show);
        }
    }

    updateResultActions(isStreaming) {
        if (!isStreaming && this.isGrammarMode && this.sourceInputElement) {
            this.toggleButtons(true);
        }
    }

    toggleButtons(show) {
        const { buttons } = this.view.elements;
        if (buttons.insert) {
            buttons.insert.classList.toggle('hidden', !show);
        }
        if (buttons.replace) {
            buttons.replace.classList.toggle('hidden', !show);
        }
    }
}
