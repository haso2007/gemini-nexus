// Must be first: cross-browser extension API shim (see shared/compat/firefox_shim.js).
import '../shared/compat/firefox_shim.js';
import { initRendererMode } from './boot/renderer.js';
import { initAppMode } from './boot/app.js';

const params = new URLSearchParams(window.location.search);
const isRendererMode = params.get('mode') === 'renderer';

if (isRendererMode) {
    initRendererMode();
} else {
    initAppMode();
}
