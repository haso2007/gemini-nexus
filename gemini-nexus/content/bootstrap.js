export function initializeContentApp({
    shortcuts,
    router,
    Overlay,
    Controller,
    storage,
} = {}) {
    const selectionOverlay = new Overlay();
    const floatingToolbar = new Controller();

    router.init(floatingToolbar, selectionOverlay);
    shortcuts.setController(floatingToolbar);

    storage.local.get(['geminiTextSelectionEnabled', 'geminiImageToolsEnabled'], (result) => {
        const selectionEnabled = result.geminiTextSelectionEnabled !== false;
        floatingToolbar.setSelectionEnabled(selectionEnabled);

        const imageToolsEnabled = result.geminiImageToolsEnabled !== false;
        floatingToolbar.setImageToolsEnabled(imageToolsEnabled);
    });

    storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.geminiTextSelectionEnabled) {
            const enabled = changes.geminiTextSelectionEnabled.newValue !== false;
            floatingToolbar.setSelectionEnabled(enabled);
        }

        if (changes.geminiImageToolsEnabled) {
            const enabled = changes.geminiImageToolsEnabled.newValue !== false;
            floatingToolbar.setImageToolsEnabled(enabled);
        }
    });

    return {
        floatingToolbar,
        selectionOverlay,
    };
}
