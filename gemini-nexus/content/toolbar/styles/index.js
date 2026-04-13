import { coreStyles } from './core.js';
import { markdownStyles } from './markdown.js';
import { panelStyles } from './panel/index.js';
import { widgetStyles } from './widget.js';

export const toolbarStyles =
    coreStyles +
    widgetStyles +
    panelStyles +
    markdownStyles;
