import { ChatController } from './chat.js';
import { SidebarController } from './sidebar.js';
import { SettingsController } from './settings.js';
import { ViewerController } from './viewer.js';
import { TabSelectorController } from './tab_selector.js';
import { resolveProvider } from '../../lib/provider.js';

export class UIController {
    constructor(elements) {
        this.chat = new ChatController(elements);

        this.sidebar = new SidebarController(elements, {
            onOverlayClick: () => this.settings.close()
        });

        this.settings = new SettingsController({
            onOpen: () => this.sidebar.close(),
            onSettingsChanged: (connectionSettings) => {
                this.updateModelList(connectionSettings);
            }
        });

        this.viewer = new ViewerController();

        this.tabSelector = new TabSelectorController();

        this.inputFn = this.chat.inputFn;
        this.historyDiv = this.chat.historyDiv;
        this.sendBtn = this.chat.sendBtn;
        this.modelSelect = elements.modelSelect;
        this.tabSwitcherBtn = document.getElementById('tab-switcher-btn');

        this.checkLayout();
        window.addEventListener('resize', () => this.checkLayout());
    }

    checkLayout() {
        const isWide = window.innerWidth > 800;
        if (isWide) {
            document.body.classList.add('layout-wide');
        } else {
            document.body.classList.remove('layout-wide');
        }
    }

    updateModelList(settings) {
        if (!this.modelSelect) return;

        const current = this.modelSelect.value;
        this.modelSelect.innerHTML = '';

        const provider = resolveProvider(settings);

        let opts = [];
        if (provider === 'official') {
            opts = [
                { val: 'gemini-3-flash-preview', txt: 'Gemini 3 Flash' },
                { val: 'gemini-3-pro-preview', txt: 'Gemini 3 Pro' }
            ];
        } else if (provider === 'openai') {
            const rawModels = settings.openaiModel || '';
            const models = rawModels.split(',').map(m => m.trim()).filter(m => m);

            if (models.length === 0) {
                opts = [{ val: 'openai_custom', txt: 'Custom Model' }];
            } else {
                opts = models.map(m => ({ val: m, txt: m }));
            }
        } else {
            opts = [
                { val: 'gemini-3-flash', txt: 'Fast' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro' }
            ];
        }

        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.txt;
            this.modelSelect.appendChild(opt);
        });

        const match = opts.find(o => o.val === current);
        if (match) {
            this.modelSelect.value = current;
        } else {
            if (opts.length > 0) {
                this.modelSelect.value = opts[0].val;
            }
            this.modelSelect.dispatchEvent(new Event('change'));
        }

        this._resizeModelSelect();
    }

    _resizeModelSelect() {
        const select = this.modelSelect;
        if (!select) return;

        if (select.selectedIndex === -1) {
            if (select.options.length > 0) select.selectedIndex = 0;
            else return;
        }

        const tempSpan = document.createElement('span');
        Object.assign(tempSpan.style, {
            visibility: 'hidden',
            position: 'absolute',
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: window.getComputedStyle(select).fontFamily,
            whiteSpace: 'nowrap'
        });
        tempSpan.textContent = select.options[select.selectedIndex].text;
        document.body.appendChild(tempSpan);
        const width = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        select.style.width = `${width + 34}px`;
    }

    updateStatus(text) { this.chat.updateStatus(text); }
    clearChatHistory() { this.chat.clear(); }
    scrollToBottom() { this.chat.scrollToBottom(); }
    resetInput() { this.chat.resetInput(); }
    setLoading(isLoading) { this.chat.setLoading(isLoading); }

    toggleSidebar() { this.sidebar.toggle(); }
    closeSidebar() { this.sidebar.close(); }
    renderHistoryList(sessions, currentId, callbacks) {
        this.sidebar.renderList(sessions, currentId, callbacks);
    }

    updateShortcuts(payload) { this.settings.updateShortcuts(payload); }
    updateTheme(theme) { this.settings.updateTheme(theme); }
    updateLanguage(lang) { this.settings.updateLanguage(lang); }

    openTabSelector(tabs, onSelect, lockedTabId) {
        this.tabSelector.open(tabs, onSelect, lockedTabId);
    }

    toggleTabSwitcher(show) {
        if (this.tabSwitcherBtn) {
            this.tabSwitcherBtn.style.display = show ? 'flex' : 'none';
        }
    }
}
