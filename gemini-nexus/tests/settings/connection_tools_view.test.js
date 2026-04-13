import { describe, expect, test, vi } from 'vitest';
import { createToolsUiState, renderToolsList } from '../../sandbox/ui/settings/sections/connection_tools_view.js';

describe('connection tools view', () => {
  test('creates default ui state with the other-tools group expanded', () => {
    const state = createToolsUiState();
    expect(state.openGroups.has('(other)')).toBe(true);
  });

  test('renders grouped tools and reports enabled tool changes', () => {
    const listEl = document.createElement('div');
    const summaryEl = document.createElement('div');
    const onEnabledToolsChange = vi.fn();

    renderToolsList({
      listEl,
      summaryEl,
      server: {
        url: 'http://127.0.0.1:3006/sse',
        toolMode: 'selected',
        enabledTools: ['alpha.fetch'],
      },
      cachedTools: [
        { name: 'alpha.fetch', description: 'Fetch data' },
        { name: 'alpha.search', description: 'Search data' },
        { name: 'plainTool', description: 'Other tool' },
      ],
      searchValue: '',
      uiState: createToolsUiState(),
      onEnabledToolsChange,
    });

    expect(summaryEl.textContent).toBe('Mode: selected. Tools exposed: 1/3.');
    expect(listEl.querySelectorAll('details').length).toBe(2);

    const firstToolCheckbox = listEl.querySelector('label input[type="checkbox"]');
    firstToolCheckbox.checked = false;
    firstToolCheckbox.dispatchEvent(new Event('change'));

    expect(onEnabledToolsChange).toHaveBeenCalledWith([]);
  });
});
