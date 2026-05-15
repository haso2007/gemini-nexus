import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendAiMessageIfDisplayable, appendTurnToHistory } from './history_manager.js';

describe('history_manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('appends a complete quick-ask continuation turn to an existing session', async () => {
        const sessions = [
            {
                id: 'session-1',
                title: 'Hello',
                timestamp: 100,
                messages: [
                    { role: 'user', text: 'Hello' },
                    { role: 'ai', text: 'Hi' },
                ],
                context: null,
            },
        ];

        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn(() => Promise.resolve()),
            },
            storage: {
                local: {
                    get: vi.fn(async () => ({ geminiSessions: sessions })),
                    set: vi.fn(async () => {}),
                },
            },
        };

        const saved = await appendTurnToHistory(
            'session-1',
            'Follow up',
            {
                status: 'success',
                text: 'Follow-up answer',
                thoughts: 'thinking',
                images: [{ url: 'https://lh3.googleusercontent.com/generated' }],
                context: null,
            },
            [{ base64: 'data:image/png;base64,AAAA' }]
        );

        expect(saved.id).toBe('session-1');
        expect(saved.messages).toEqual([
            { role: 'user', text: 'Hello' },
            { role: 'ai', text: 'Hi' },
            {
                role: 'user',
                text: 'Follow up',
                image: ['data:image/png;base64,AAAA'],
                attachments: [
                    {
                        base64: 'data:image/png;base64,AAAA',
                        type: 'image/png',
                        name: 'attachment-1.png',
                    },
                ],
            },
            {
                role: 'ai',
                text: 'Follow-up answer',
                thoughts: 'thinking',
                thoughtsDurationSeconds: undefined,
                sources: null,
                generatedImages: [{ url: 'https://lh3.googleusercontent.com/generated' }],
                thoughtSignature: undefined,
                officialContent: null,
                suppressCopy: false,
            },
        ]);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            geminiSessions: [saved],
        });
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'SESSIONS_UPDATED',
            sessions: [saved],
        });
    });

    it('persists non-image quick-ask attachments with metadata', async () => {
        const sessions = [
            {
                id: 'session-1',
                title: 'Hello',
                timestamp: 100,
                messages: [],
                context: null,
            },
        ];

        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn(() => Promise.resolve()),
            },
            storage: {
                local: {
                    get: vi.fn(async () => ({ geminiSessions: sessions })),
                    set: vi.fn(async () => {}),
                },
            },
        };

        const saved = await appendTurnToHistory(
            'session-1',
            'Review spec',
            {
                status: 'success',
                text: 'Done',
                thoughts: null,
                images: [],
                context: null,
            },
            [
                {
                    base64: 'data:application/pdf;base64,BBBB',
                    type: 'application/pdf',
                    name: 'spec.pdf',
                },
            ]
        );

        expect(saved.messages[0]).toEqual({
            role: 'user',
            text: 'Review spec',
            image: null,
            attachments: [
                {
                    base64: 'data:application/pdf;base64,BBBB',
                    type: 'application/pdf',
                    name: 'spec.pdf',
                },
            ],
        });
    });

    it('persists generated-image-only AI messages when they are displayable', async () => {
        const sessions = [
            {
                id: 'session-1',
                title: 'Image',
                timestamp: 100,
                messages: [{ role: 'user', text: 'Generate image' }],
                context: null,
            },
        ];

        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn(() => Promise.resolve()),
            },
            storage: {
                local: {
                    get: vi.fn(async () => ({ geminiSessions: sessions })),
                    set: vi.fn(async () => {}),
                },
            },
        };

        await expect(
            appendAiMessageIfDisplayable('session-1', {
                status: 'success',
                text: '',
                images: [{ url: 'https://lh3.googleusercontent.com/generated' }],
                context: null,
            })
        ).resolves.toBe(true);

        expect(sessions[0].messages.at(-1)).toEqual({
            role: 'ai',
            text: '',
            thoughts: null,
            thoughtsDurationSeconds: undefined,
            sources: null,
            generatedImages: [{ url: 'https://lh3.googleusercontent.com/generated' }],
            thoughtSignature: undefined,
            officialContent: null,
            suppressCopy: false,
        });
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            geminiSessions: [sessions[0]],
        });
    });
});
