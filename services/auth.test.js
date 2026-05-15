import { describe, expect, it, vi } from 'vitest';
import { fetchRequestParams } from './auth.js';

describe('fetchRequestParams', () => {
    it('extracts current Gemini web request tokens from logged-in HTML', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            text: () =>
                Promise.resolve(
                    '<html lang="zh-CN"><script>{"SNlM0e":"at-token","cfb2h":"boq_assistant-bard-web-server_20260511.16_p5","FdrFJe":"3956664217185504700","qKIAYe":"feeds/upload-dynamic","Ylro7b":"client-pctx-token"}</script><div data-index="2"></div></html>'
                ),
        });

        await expect(fetchRequestParams('2')).resolves.toEqual({
            atValue: 'at-token',
            blValue: 'boq_assistant-bard-web-server_20260511.16_p5',
            fSid: '3956664217185504700',
            locale: 'zh-CN',
            authUserIndex: '2',
            uploadPushId: 'feeds/upload-dynamic',
            uploadClientPctx: 'client-pctx-token',
        });
    });
});
