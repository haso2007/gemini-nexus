import { describe, expect, test, vi } from 'vitest';
import { bindProviderEvents } from '../../sandbox/ui/settings/sections/connection_provider_events.js';
import { bindMcpEvents } from '../../sandbox/ui/settings/sections/connection_mcp_events.js';

describe('connection event binders', () => {
  test('provider events forward provider and enabled changes', () => {
    const providerSelect = document.createElement('select');
    providerSelect.innerHTML = '<option value="web">web</option><option value="openai">openai</option>';
    const mcpEnabled = document.createElement('input');
    mcpEnabled.type = 'checkbox';

    const section = {
      elements: { providerSelect, mcpEnabled },
      updateVisibility: vi.fn(),
      updateMcpVisibility: vi.fn(),
    };

    bindProviderEvents(section);

    providerSelect.value = 'openai';
    providerSelect.dispatchEvent(new Event('change'));
    mcpEnabled.checked = true;
    mcpEnabled.dispatchEvent(new Event('change'));

    expect(section.updateVisibility).toHaveBeenCalledWith('openai');
    expect(section.updateMcpVisibility).toHaveBeenCalledWith(true);
  });

  test('mcp events delegate add-server action through section helpers', () => {
    const addButton = document.createElement('button');
    const section = {
      elements: { mcpAddServer: addButton },
      _saveCurrentServerEdits: vi.fn(),
      _getDefaultServer: vi.fn().mockReturnValue({ id: 'srv_2' }),
      _renderMcpServerOptions: vi.fn(),
      _loadActiveServerIntoForm: vi.fn(),
      setMcpTestStatus: vi.fn(),
      mcpServers: [{ id: 'srv_1' }],
      mcpActiveServerId: 'srv_1',
    };

    bindMcpEvents(section);
    addButton.dispatchEvent(new Event('click'));

    expect(section._saveCurrentServerEdits).toHaveBeenCalled();
    expect(section.mcpServers.map((server) => server.id)).toEqual(['srv_1', 'srv_2']);
    expect(section.mcpActiveServerId).toBe('srv_2');
  });
});
