export async function sendPayloadToSender(sender, payload, deps = {}) {
  const tabs = deps.tabs || chrome.tabs;
  const runtime = deps.runtime || chrome.runtime;

  if (sender?.tab?.id) {
    await tabs.sendMessage(sender.tab.id, payload).catch(() => {});
    return;
  }

  await runtime.sendMessage(payload).catch(() => {});
}

export async function resolveWindowId(sender, queryTabs) {
  if (sender?.tab?.windowId) {
    return sender.tab.windowId;
  }

  const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  return tabs?.[0]?.windowId ?? null;
}

export function buildMcpRequestConfig(request = {}) {
  return {
    transport: (request.transport || 'sse').toLowerCase(),
    url: (request.url || '').trim(),
  };
}

export function mapToolsForUi(tools) {
  return Array.isArray(tools)
    ? tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
      }))
    : [];
}
