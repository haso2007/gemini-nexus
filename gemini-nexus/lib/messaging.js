// lib/messaging.js

const PARENT_ORIGIN = window.location.origin;

function postToParent(action, payload) {
    const message = payload === undefined ? { action } : { action, payload };
    window.parent.postMessage(message, PARENT_ORIGIN);
}

export function sendToBackground(payload) {
    postToParent('FORWARD_TO_BACKGROUND', payload);
}

export function saveSessionsToStorage(sessions) {
    postToParent('SAVE_SESSIONS', sessions);
}

export function saveShortcutsToStorage(shortcuts) {
    postToParent('SAVE_SHORTCUTS', shortcuts);
}

export function requestThemeFromStorage() {
    postToParent('GET_THEME');
}

export function saveThemeToStorage(theme) {
    postToParent('SAVE_THEME', theme);
}

export function requestLanguageFromStorage() {
    postToParent('GET_LANGUAGE');
}

export function saveLanguageToStorage(lang) {
    postToParent('SAVE_LANGUAGE', lang);
}

export function requestTextSelectionFromStorage() {
    postToParent('GET_TEXT_SELECTION');
}

export function saveTextSelectionToStorage(enabled) {
    postToParent('SAVE_TEXT_SELECTION', enabled);
}

export function requestImageToolsFromStorage() {
    postToParent('GET_IMAGE_TOOLS');
}

export function saveImageToolsToStorage(enabled) {
    postToParent('SAVE_IMAGE_TOOLS', enabled);
}

export function saveSidebarBehaviorToStorage(behavior) {
    postToParent('SAVE_SIDEBAR_BEHAVIOR', behavior);
}

export function requestAccountIndicesFromStorage() {
    postToParent('GET_ACCOUNT_INDICES');
}

export function saveAccountIndicesToStorage(indices) {
    postToParent('SAVE_ACCOUNT_INDICES', indices);
}

export function requestConnectionSettingsFromStorage() {
    postToParent('GET_CONNECTION_SETTINGS');
}

export function saveConnectionSettingsToStorage(data) {
    postToParent('SAVE_CONNECTION_SETTINGS', data);
}

export function signalUiReady() {
    postToParent('UI_READY');
}

export function openFullPage() {
    postToParent('OPEN_FULL_PAGE');
}

export function saveModelToStorage(model) {
    postToParent('SAVE_MODEL', model);
}

export function downloadImageFromParent(url, filename) {
    postToParent('DOWNLOAD_IMAGE', { url, filename });
}

export function downloadLogsFromParent(text, filename) {
    postToParent('DOWNLOAD_LOGS', { text, filename });
}
