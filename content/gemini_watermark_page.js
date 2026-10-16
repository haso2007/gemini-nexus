(function () {
    if (window.GeminiNexusGeminiWatermarkRemoverPage?.installed === true) return;

    window.GeminiNexusGeminiWatermarkRemoverPage = {
        installed: true,
    };

    window.addEventListener('message', (event) => {
        if (event.source !== window || typeof event.data !== 'string') return;
        let parsed;
        try {
            parsed = JSON.parse(event.data);
        } catch {
            return;
        }
        if (!parsed || typeof parsed.type !== 'string' || !parsed.type.startsWith('GWR_')) return;
        window.postMessage(parsed, '*');
    });
})();
