// background/managers/session/history_store.js

function resolveStorage(storage) {
    return storage || chrome.storage.local;
}

export async function loadSessions(storage = null) {
    const target = resolveStorage(storage);
    const { geminiSessions = [] } = await target.get(['geminiSessions']);
    return Array.isArray(geminiSessions) ? geminiSessions : [];
}

export async function saveSessions(sessions, storage = null) {
    const target = resolveStorage(storage);
    await target.set({ geminiSessions: sessions });
}

export function findSessionById(sessions, sessionId) {
    if (!sessionId || !Array.isArray(sessions)) return null;
    return sessions.find((session) => session.id === sessionId) || null;
}

export function hasAiResponse(session) {
    return Boolean(session && Array.isArray(session.messages) && session.messages.some((message) => message.role === 'ai'));
}

export function moveSessionToFront(sessions, sessionIndex) {
    if (!Array.isArray(sessions)) return [];
    if (sessionIndex <= 0 || sessionIndex >= sessions.length) return [...sessions];

    const nextSessions = [...sessions];
    const [session] = nextSessions.splice(sessionIndex, 1);
    nextSessions.unshift(session);
    return nextSessions;
}

export async function getHistory(sessionId, storage = null) {
    if (!sessionId) return [];
    const sessions = await loadSessions(storage);
    const session = findSessionById(sessions, sessionId);
    return session && Array.isArray(session.messages) ? session.messages : [];
}
