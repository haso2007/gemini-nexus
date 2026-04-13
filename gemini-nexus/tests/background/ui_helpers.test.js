import { describe, expect, test, vi } from 'vitest';
import {
  buildMcpRequestConfig,
  mapToolsForUi,
  resolveWindowId,
  sendPayloadToSender,
} from '../../background/handlers/ui_helpers.js';

describe('ui handler helpers', () => {
  test('sends payload to sender tab when available', async () => {
    const tabs = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    const runtime = { sendMessage: vi.fn().mockResolvedValue(undefined) };

    await sendPayloadToSender({ tab: { id: 123 } }, { action: 'X' }, { tabs, runtime });

    expect(tabs.sendMessage).toHaveBeenCalledWith(123, { action: 'X' });
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });

  test('falls back to runtime message when sender tab is unavailable', async () => {
    const tabs = { sendMessage: vi.fn() };
    const runtime = { sendMessage: vi.fn().mockResolvedValue(undefined) };

    await sendPayloadToSender({}, { action: 'X' }, { tabs, runtime });

    expect(runtime.sendMessage).toHaveBeenCalledWith({ action: 'X' });
  });

  test('resolves sender window id before querying active tab', async () => {
    const queryTabs = vi.fn().mockResolvedValue([{ windowId: 9 }]);

    await expect(resolveWindowId({ tab: { windowId: 7 } }, queryTabs)).resolves.toBe(7);
    await expect(resolveWindowId({}, queryTabs)).resolves.toBe(9);
  });

  test('builds mcp request config and ui-safe tool payloads', () => {
    expect(buildMcpRequestConfig({ transport: 'ws', url: 'ws://127.0.0.1' })).toEqual({
      transport: 'ws',
      url: 'ws://127.0.0.1',
    });

    expect(mapToolsForUi([{ name: 'fetch', description: 'Fetch data', inputSchema: { foo: 'bar' } }])).toEqual([
      { name: 'fetch', description: 'Fetch data' },
    ]);
  });
});
