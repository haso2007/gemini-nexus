import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOpenAIMessage } from './openai_compatible.js';

function makeChatSseStream(text = 'ok') {
    const encoder = new TextEncoder();
    const payload = `data: ${JSON.stringify({
        choices: [{ delta: { content: text } }],
    })}\n\ndata: [DONE]\n\n`;

    return {
        getReader() {
            return {
                read: vi
                    .fn()
                    .mockResolvedValueOnce({ done: false, value: encoder.encode(payload) })
                    .mockResolvedValueOnce({ done: true }),
            };
        },
    };
}

describe('sendOpenAIMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: makeChatSseStream('done'),
        });
    });

    it('replays stored user image attachments from normalized metadata', async () => {
        await sendOpenAIMessage(
            'Continue',
            '',
            [
                {
                    role: 'user',
                    text: 'Look at this',
                    attachments: [
                        {
                            base64: 'data:image/png;base64,AAAA',
                            type: 'image/png',
                            name: 'image.png',
                        },
                    ],
                },
            ],
            {
                baseUrl: 'https://api.example.test/v1',
                model: 'gpt-test',
            },
            [],
            null,
            vi.fn()
        );

        const [, init] = global.fetch.mock.calls[0];
        const payload = JSON.parse(init.body);
        expect(payload.messages[0]).toEqual({
            role: 'user',
            content: [
                { type: 'text', text: 'Look at this' },
                {
                    type: 'image_url',
                    image_url: {
                        url: 'data:image/png;base64,AAAA',
                    },
                },
            ],
        });
    });

    it('marks stored non-image attachments instead of silently dropping them', async () => {
        await sendOpenAIMessage(
            'Continue',
            '',
            [
                {
                    role: 'user',
                    text: 'Review spec',
                    attachments: [
                        {
                            base64: 'data:application/pdf;base64,BBBB',
                            type: 'application/pdf',
                            name: 'spec.pdf',
                        },
                    ],
                },
            ],
            {
                baseUrl: 'https://api.example.test/v1',
                model: 'gpt-test',
            },
            [],
            null,
            vi.fn()
        );

        const [, init] = global.fetch.mock.calls[0];
        const payload = JSON.parse(init.body);
        expect(payload.messages[0]).toEqual({
            role: 'user',
            content: 'Review spec\n[1 unsupported file attachment(s) omitted: spec.pdf]',
        });
    });

    it('rejects current non-image attachments before sending an OpenAI request', async () => {
        await expect(
            sendOpenAIMessage(
                'Review attached spec',
                '',
                [],
                {
                    baseUrl: 'https://api.example.test/v1',
                    model: 'gpt-test',
                },
                [
                    {
                        base64: 'data:application/pdf;base64,BBBB',
                        type: 'application/pdf',
                        name: 'spec.pdf',
                    },
                ],
                null,
                vi.fn()
            )
        ).rejects.toThrow(/supports image attachments only/);

        expect(global.fetch).not.toHaveBeenCalled();
    });
});
