import {
  buildToolsSummary,
  filterToolsBySearch,
  groupToolsByPrefix,
  sortToolGroupNames,
} from './connection_tools.js';

const UNGROUPED_KEY = '(other)';

export function createToolsUiState() {
  return { openGroups: new Set([UNGROUPED_KEY]) };
}

export function renderToolsList({
  listEl,
  summaryEl,
  server,
  cachedTools,
  searchValue,
  uiState,
  onEnabledToolsChange,
}) {
  if (!server || !listEl || !summaryEl) return;

  const toolMode = server.toolMode === 'selected' ? 'selected' : 'all';
  const enabledSet = new Set(Array.isArray(server.enabledTools) ? server.enabledTools : []);
  const cached = Array.isArray(cachedTools) ? cachedTools : [];

  summaryEl.textContent = buildToolsSummary(server, cached, enabledSet);
  listEl.innerHTML = '';

  if (toolMode === 'all') {
    const div = document.createElement('div');
    div.style.opacity = '0.85';
    div.style.fontSize = '12px';
    div.textContent = 'Switch to "Selected tools only" to choose which tools the model can use.';
    listEl.appendChild(div);
    return;
  }

  if (cached.length === 0) {
    const div = document.createElement('div');
    div.style.opacity = '0.85';
    div.style.fontSize = '12px';
    div.textContent = 'No tools loaded yet.';
    listEl.appendChild(div);
    return;
  }

  const filtered = filterToolsBySearch(cached, searchValue);
  const groups = groupToolsByPrefix(filtered);
  const sortedGroupNames = sortToolGroupNames(Array.from(groups.keys()));

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '10px';

  const updateEnabledTools = () => {
    onEnabledToolsChange(Array.from(enabledSet));
  };

  const renderToolRow = (tool) => {
    const toolName = tool.name || '';
    const dot = toolName.indexOf('.');
    const displayName = dot > 0 ? toolName.slice(dot + 1) : toolName;

    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '8px';
    row.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabledSet.has(toolName);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) enabledSet.add(toolName);
      else enabledSet.delete(toolName);
      updateEnabledTools();
    });

    const text = document.createElement('div');
    text.style.display = 'flex';
    text.style.flexDirection = 'column';
    text.style.gap = '2px';

    const nameEl = document.createElement('div');
    nameEl.style.fontSize = '12px';
    nameEl.style.fontWeight = '500';
    nameEl.textContent = displayName;

    const fullEl = document.createElement('div');
    fullEl.style.fontSize = '11px';
    fullEl.style.opacity = '0.7';
    fullEl.textContent = toolName;

    text.appendChild(nameEl);
    text.appendChild(fullEl);

    if (tool.description) {
      const descEl = document.createElement('div');
      descEl.style.fontSize = '11px';
      descEl.style.opacity = '0.85';
      descEl.textContent = tool.description;
      text.appendChild(descEl);
    }

    row.appendChild(checkbox);
    row.appendChild(text);
    return row;
  };

  const renderGroup = (groupName, tools) => {
    const sortedTools = [...tools].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const toolNames = sortedTools.map((tool) => tool.name).filter(Boolean);
    const enabledCountInGroup = toolNames.filter((name) => enabledSet.has(name)).length;
    const totalInGroup = toolNames.length;

    const details = document.createElement('details');
    details.open = uiState.openGroups.has(groupName);
    details.addEventListener('toggle', () => {
      if (details.open) uiState.openGroups.add(groupName);
      else uiState.openGroups.delete(groupName);
    });

    const summary = document.createElement('summary');
    summary.style.cursor = 'pointer';
    summary.style.userSelect = 'none';
    summary.style.display = 'flex';
    summary.style.alignItems = 'center';
    summary.style.justifyContent = 'space-between';
    summary.style.gap = '10px';
    summary.style.padding = '6px 8px';
    summary.style.background = 'rgba(0,0,0,0.04)';
    summary.style.borderRadius = '8px';
    summary.style.listStyle = 'none';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

    const groupCheckbox = document.createElement('input');
    groupCheckbox.type = 'checkbox';
    groupCheckbox.checked = totalInGroup > 0 && enabledCountInGroup === totalInGroup;
    groupCheckbox.indeterminate = enabledCountInGroup > 0 && enabledCountInGroup < totalInGroup;
    groupCheckbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    groupCheckbox.addEventListener('change', () => {
      if (groupCheckbox.checked) {
        for (const name of toolNames) enabledSet.add(name);
      } else {
        for (const name of toolNames) enabledSet.delete(name);
      }
      updateEnabledTools();
    });

    const groupTitle = document.createElement('div');
    groupTitle.style.fontSize = '12px';
    groupTitle.style.fontWeight = '600';
    groupTitle.textContent = groupName === UNGROUPED_KEY ? 'Other tools' : groupName;

    left.appendChild(groupCheckbox);
    left.appendChild(groupTitle);

    const right = document.createElement('div');
    right.style.fontSize = '12px';
    right.style.opacity = '0.85';
    right.textContent = `${enabledCountInGroup}/${totalInGroup}`;

    summary.appendChild(left);
    summary.appendChild(right);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '6px';
    list.style.padding = '8px 2px 2px 2px';

    for (const tool of sortedTools) {
      list.appendChild(renderToolRow(tool));
    }

    details.appendChild(summary);
    details.appendChild(list);
    return details;
  };

  for (const groupName of sortedGroupNames) {
    container.appendChild(renderGroup(groupName, groups.get(groupName)));
  }

  listEl.appendChild(container);
}
