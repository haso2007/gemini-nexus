import { describe, expect, test, vi } from 'vitest';
import {
  findSessionById,
  getHistory,
  hasAiResponse,
  loadSessions,
  moveSessionToFront,
  saveSessions,
} from '../../background/managers/session/history_store.js';

describe('session history store helpers', () => {
  test('loads sessions with an empty-array fallback', async () => {
    const storage = {
      get: vi.fn().mockResolvedValue({}),
    };

    await expect(loadSessions(storage)).resolves.toEqual([]);
    expect(storage.get).toHaveBeenCalledWith(['geminiSessions']);
  });

  test('saves sessions back to storage', async () => {
    const storage = {
      set: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = [{ id: 's1' }];

    await saveSessions(sessions, storage);

    expect(storage.set).toHaveBeenCalledWith({ geminiSessions: sessions });
  });

  test('finds sessions and returns message history', async () => {
    const sessions = [
      { id: 's1', messages: [{ role: 'user', text: 'hi' }] },
      { id: 's2', messages: [{ role: 'ai', text: 'hello' }] },
    ];
    const storage = {
      get: vi.fn().mockResolvedValue({ geminiSessions: sessions }),
    };

    expect(findSessionById(sessions, 's2')).toEqual(sessions[1]);
    await expect(getHistory('s1', storage)).resolves.toEqual([{ role: 'user', text: 'hi' }]);
    await expect(getHistory('missing', storage)).resolves.toEqual([]);
  });

  test('detects ai replies and moves sessions to the front', () => {
    const sessions = [
      { id: 'oldest', messages: [] },
      { id: 'active', messages: [{ role: 'ai', text: 'done' }] },
      { id: 'other', messages: [{ role: 'user', text: 'x' }] },
    ];

    expect(hasAiResponse(sessions[1])).toBe(true);
    expect(hasAiResponse(sessions[2])).toBe(false);
    expect(hasAiResponse(null)).toBe(false);

    const reordered = moveSessionToFront(sessions, 1);
    expect(reordered.map((session) => session.id)).toEqual(['active', 'oldest', 'other']);
    expect(sessions.map((session) => session.id)).toEqual(['oldest', 'active', 'other']);
  });
});
