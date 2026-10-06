import {
    CONNECTION_STORAGE_KEYS,
    createConnectionSettingsPayload,
} from '../../shared/settings/connection.js';

export function getRuntimeLastError() {
    const message = chrome.runtime?.lastError?.message;
    return message ? new Error(message) : null;
}

const INPUT_DRAFTS_KEY = 'geminiSidePanelInputDrafts';

function logSessionBindingWriteError(error) {
    console.warn('Unable to save side panel session binding after storage write failed:', error);
}

function logInputDraftWriteError(error) {
    console.warn('Unable to save side panel input draft after storage write failed:', error);
}

export function getSidePanelInputDraftKey(tabId, sessionId = null) {
    if (sessionId) return `session:${sessionId}`;
    if (Number.isInteger(tabId) && tabId > 0) return `draft:${tabId}`;
    return 'draft';
}

export function getLegacySidePanelInputDraftKey(tabId, sessionId = null) {
    if (!Number.isInteger(tabId) || tabId <= 0) return null;
    return sessionId ? `tab:${tabId}|session:${sessionId}` : `tab:${tabId}|draft`;
}

export function normalizeComposerDraft(value) {
    if (typeof value === 'string') {
        return { text: value, files: [] };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { text: '', files: [] };
    }

    const files = Array.isArray(value.files)
        ? value.files
              .filter((file) => file && typeof file === 'object' && typeof file.base64 === 'string')
              .map((file) => ({
                  base64: file.base64,
                  type: typeof file.type === 'string' ? file.type : 'application/octet-stream',
                  name: typeof file.name === 'string' ? file.name : 'attachment',
              }))
        : [];

    return {
        text: typeof value.text === 'string' ? value.text : '',
        files,
    };
}

export function isEmptyComposerDraft(value) {
    const draft = normalizeComposerDraft(value);
    return !draft.text && draft.files.length === 0;
}

export function normalizeSidePanelInputDrafts(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const drafts = {};
    Object.entries(value).forEach(([key, draftValue]) => {
        if (typeof key !== 'string' || !key) return;
        const draft = normalizeComposerDraft(draftValue);
        if (!isEmptyComposerDraft(draft)) drafts[key] = draft;
    });
    return drafts;
}

export function restoreConnectionSettings(frame) {
    chrome.storage.local.get(CONNECTION_STORAGE_KEYS, (result) => {
        const readError = getRuntimeLastError();
        if (readError) {
            console.warn(
                'Unable to restore connection settings after storage read failed:',
                readError
            );
            return;
        }

        frame.postMessage({
            action: 'RESTORE_CONNECTION_SETTINGS',
            payload: createConnectionSettingsPayload(result, { includeLegacyFallbacks: true }),
        });
    });
}

export function restoreSidebarExpanded(frame) {
    chrome.storage.local.get(['geminiSidebarExpanded'], (result) => {
        const readError = getRuntimeLastError();
        if (readError) {
            console.warn(
                'Unable to restore sidebar expanded state after storage read failed:',
                readError
            );
            return;
        }

        frame.postMessage({
            action: 'RESTORE_SIDEBAR_EXPANDED',
            payload: result.geminiSidebarExpanded !== false,
        });
    });
}

export function saveSidePanelInputDraft(payload) {
    const tabId = payload?.tabId;
    const sessionId = payload?.sessionId || null;
    const key = getSidePanelInputDraftKey(tabId, sessionId);
    const legacyKey = getLegacySidePanelInputDraftKey(tabId, sessionId);

    chrome.storage.session.get([INPUT_DRAFTS_KEY], (result) => {
        const readError = getRuntimeLastError();
        if (readError) {
            console.warn('Unable to save side panel input draft after storage read failed:', readError);
            return;
        }

        const drafts = { ...normalizeSidePanelInputDrafts(result?.[INPUT_DRAFTS_KEY]) };
        const draft = normalizeComposerDraft(payload?.value);
        if (!isEmptyComposerDraft(draft)) {
            drafts[key] = draft;
        } else {
            delete drafts[key];
        }
        if (legacyKey && legacyKey !== key) delete drafts[legacyKey];

        try {
            const writeResult = chrome.storage.session.set({ [INPUT_DRAFTS_KEY]: drafts });
            writeResult?.catch?.(logInputDraftWriteError);
        } catch (error) {
            logInputDraftWriteError(error);
        }
    });
}

export function saveSidePanelSessionBinding(payload) {
    const tabId = payload?.tabId;
    const sessionId = payload?.sessionId || null;
    if (!Number.isInteger(tabId) || tabId <= 0) return;

    chrome.storage.session.get(['geminiSidePanelSessionBindings'], (result) => {
        const readError = getRuntimeLastError();
        if (readError) {
            console.warn(
                'Unable to save side panel session binding after storage read failed:',
                readError
            );
            return;
        }

        const bindings =
            result?.geminiSidePanelSessionBindings &&
            typeof result.geminiSidePanelSessionBindings === 'object' &&
            !Array.isArray(result.geminiSidePanelSessionBindings)
                ? { ...result.geminiSidePanelSessionBindings }
                : {};
        if (sessionId) {
            bindings[tabId] = sessionId;
        } else {
            delete bindings[tabId];
        }
        try {
            const writeResult = chrome.storage.session.set({
                geminiSidePanelSessionBindings: bindings,
            });
            writeResult?.catch?.(logSessionBindingWriteError);
        } catch (error) {
            logSessionBindingWriteError(error);
        }
    });
}
