export function buildToolsSummary(server, cachedTools, enabledSet) {
  const total = cachedTools.length;
  const enabledCount = server.toolMode === 'all' ? total : enabledSet.size;

  if (!server.url || !server.url.trim()) {
    return 'Set Server URL to manage tools.';
  }

  if (total === 0) {
    return server.toolMode === 'all'
      ? 'All tools will be exposed. Click "Refresh Tools" to preview the tool list.'
      : 'No tool list loaded. Click "Refresh Tools" to load tools, then select which to expose.';
  }

  return `Mode: ${server.toolMode}. Tools exposed: ${enabledCount}/${total}.`;
}

export function filterToolsBySearch(tools, search) {
  const query = (search || '').trim().toLowerCase();
  if (!query) return tools;
  return tools.filter((tool) =>
    (tool.name || '').toLowerCase().includes(query) ||
    (tool.description || '').toLowerCase().includes(query)
  );
}

export function groupToolsByPrefix(tools) {
  const groups = new Map();
  const ungroupedKey = '(other)';

  for (const tool of tools) {
    const toolName = tool.name || '';
    if (!toolName) continue;
    const dot = toolName.indexOf('.');
    const group = dot > 0 ? toolName.slice(0, dot) : ungroupedKey;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(tool);
  }

  return groups;
}

export function sortToolGroupNames(groupNames) {
  return [...groupNames].sort((a, b) => {
    if (a === '(other)') return 1;
    if (b === '(other)') return -1;
    return a.localeCompare(b);
  });
}
