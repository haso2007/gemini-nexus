import { describe, expect, test } from 'vitest';
import {
  buildToolsSummary,
  filterToolsBySearch,
  groupToolsByPrefix,
  sortToolGroupNames,
} from '../../sandbox/ui/settings/sections/connection_tools.js';

describe('connection tools helpers', () => {
  const tools = [
    { name: 'alpha.fetch', description: 'Fetch data' },
    { name: 'alpha.search', description: 'Search data' },
    { name: 'plainTool', description: 'Other tool' },
  ];

  test('filters tools by name and description', () => {
    expect(filterToolsBySearch(tools, 'fetch')).toEqual([tools[0]]);
    expect(filterToolsBySearch(tools, 'other')).toEqual([tools[2]]);
  });

  test('groups tools by prefix and sorts group names', () => {
    const groups = groupToolsByPrefix(tools);
    const names = sortToolGroupNames(Array.from(groups.keys()));

    expect(names).toEqual(['alpha', '(other)']);
    expect(groups.get('alpha')).toHaveLength(2);
    expect(groups.get('(other)')).toHaveLength(1);
  });

  test('builds summary text for all/selected modes', () => {
    expect(buildToolsSummary({ url: '', toolMode: 'all' }, [], new Set())).toBe('Set Server URL to manage tools.');
    expect(buildToolsSummary({ url: 'http://127.0.0.1', toolMode: 'all' }, [], new Set())).toContain('Click "Refresh Tools"');
    expect(buildToolsSummary({ url: 'http://127.0.0.1', toolMode: 'selected' }, tools, new Set(['alpha.fetch']))).toBe('Mode: selected. Tools exposed: 1/3.');
  });
});
