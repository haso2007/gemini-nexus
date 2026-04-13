
// sandbox/ui/settings/sections/connection.js
import { createDefaultMcpServer, normalizeMcpConnection, serializeMcpConnection } from '../../../../lib/mcp_servers.js';
import {
    applyServerFormState,
    buildServerOptions,
    getActiveServer,
    getServerFormState,
} from './connection_server_state.js';
import {
    getCachedTools,
    getServerKey,
    getToolsUiState,
    setCachedTools,
} from './connection_tool_state.js';
import { bindConnectionEvents } from './connection_events.js';
import { renderToolsList } from './connection_tools_view.js';

export class ConnectionSection {
    constructor() {
        this.elements = {};
        this.mcpServers = [];
        this.mcpActiveServerId = null;
        this.mcpToolsCache = new Map(); // serverId -> { key, tools }
        this.mcpToolsUiState = new Map(); // serverId -> { openGroups: Set<string> }
        this.queryElements();
        bindConnectionEvents(this);
    }

    _makeServerId() {
        return `srv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    _getDefaultServer() {
        return createDefaultMcpServer({ id: this._makeServerId() });
    }

    _getDefaultUrlForTransport(transport) {
        const t = (transport || 'sse').toLowerCase();
        if (t === 'ws' || t === 'websocket') return 'ws://127.0.0.1:3006/mcp';
        if (t === 'streamable-http' || t === 'streamablehttp') return 'http://127.0.0.1:3006/mcp';
        return 'http://127.0.0.1:3006/sse';
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            providerSelect: get('provider-select'),
            apiKeyContainer: get('api-key-container'),
            
            // Official Fields
            officialFields: get('official-fields'),
            apiKeyInput: get('api-key-input'),
            thinkingLevelSelect: get('thinking-level-select'),
            
            // OpenAI Fields
            openaiFields: get('openai-fields'),
            openaiBaseUrl: get('openai-base-url'),
            openaiApiKey: get('openai-api-key'),
            openaiModel: get('openai-model'),

            // MCP Fields
            mcpEnabled: get('mcp-enabled'),
            mcpFields: get('mcp-fields'),
            mcpServerSelect: get('mcp-server-select'),
            mcpAddServer: get('mcp-add-server'),
            mcpRemoveServer: get('mcp-remove-server'),
            mcpServerName: get('mcp-server-name'),
            mcpTransport: get('mcp-transport'),
            mcpServerUrl: get('mcp-server-url'),
            mcpServerEnabled: get('mcp-server-enabled'),
            mcpTestConnection: get('mcp-test-connection'),
            mcpTestStatus: get('mcp-test-status'),
            mcpToolMode: get('mcp-tool-mode'),
            mcpRefreshTools: get('mcp-refresh-tools'),
            mcpEnableAllTools: get('mcp-enable-all-tools'),
            mcpDisableAllTools: get('mcp-disable-all-tools'),
            mcpToolSearch: get('mcp-tool-search'),
            mcpToolsSummary: get('mcp-tools-summary'),
            mcpToolList: get('mcp-tool-list'),
        };
    }

    setData(data) {
        const { 
            providerSelect, apiKeyInput, thinkingLevelSelect, 
            openaiBaseUrl, openaiApiKey, openaiModel,
            mcpEnabled
        } = this.elements;

        // Provider
        if (providerSelect) {
            providerSelect.value = data.provider || 'web';
            this.updateVisibility(data.provider || 'web');
        }
        
        // Official
        if (apiKeyInput) apiKeyInput.value = data.apiKey || "";
        if (thinkingLevelSelect) thinkingLevelSelect.value = data.thinkingLevel || "low";
        
        // OpenAI
        if (openaiBaseUrl) openaiBaseUrl.value = data.openaiBaseUrl || "";
        if (openaiApiKey) openaiApiKey.value = data.openaiApiKey || "";
        if (openaiModel) openaiModel.value = data.openaiModel || "";

        // MCP
        if (mcpEnabled) {
            mcpEnabled.checked = data.mcpEnabled === true;
            this.updateMcpVisibility(mcpEnabled.checked);
        }

        // Servers list (preferred)
        const normalized = normalizeMcpConnection(data, { includeDefault: true });
        this.mcpServers = normalized.mcpServers.map((server) => ({
            ...server,
            id: server.id || this._makeServerId(),
        }));
        this.mcpActiveServerId = normalized.mcpActiveServerId || this.mcpServers[0].id;

        this._renderMcpServerOptions();
        this._loadActiveServerIntoForm();
        this.setMcpTestStatus('');
    }

    getData() {
        const {
            providerSelect, apiKeyInput, thinkingLevelSelect,
            openaiBaseUrl, openaiApiKey, openaiModel,
            mcpEnabled
        } = this.elements;

        this._saveCurrentServerEdits();
        const servers = Array.isArray(this.mcpServers) ? this.mcpServers : [];
        return {
            provider: providerSelect ? providerSelect.value : 'web',
            // Official
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
            thinkingLevel: thinkingLevelSelect ? thinkingLevelSelect.value : "low",
            // OpenAI
            openaiBaseUrl: openaiBaseUrl ? openaiBaseUrl.value.trim() : "",
            openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : "",
            openaiModel: openaiModel ? openaiModel.value.trim() : "",

            // MCP - Multi-server mode: all enabled servers will be used
            ...serializeMcpConnection({
                mcpEnabled: mcpEnabled ? mcpEnabled.checked === true : false,
                mcpServers: servers,
                mcpActiveServerId: this.mcpActiveServerId || (servers[0] ? servers[0].id : null),
            })
        };
    }

    updateVisibility(provider) {
        const { apiKeyContainer, officialFields, openaiFields } = this.elements;
        if (!apiKeyContainer) return;

        if (provider === 'web') {
            apiKeyContainer.style.display = 'none';
        } else {
            apiKeyContainer.style.display = 'flex';
            if (provider === 'official') {
                if (officialFields) officialFields.style.display = 'flex';
                if (openaiFields) openaiFields.style.display = 'none';
            } else if (provider === 'openai') {
                if (officialFields) officialFields.style.display = 'none';
                if (openaiFields) openaiFields.style.display = 'flex';
            }
        }
    }

    updateMcpVisibility(enabled) {
        const { mcpFields } = this.elements;
        if (!mcpFields) return;
        mcpFields.style.display = enabled ? 'flex' : 'none';
    }

    _getActiveServer() {
        return getActiveServer(this.mcpServers, this.mcpActiveServerId);
    }

    _saveCurrentServerEdits() {
        const {
            mcpServerName,
            mcpTransport,
            mcpServerUrl,
            mcpServerEnabled,
            mcpToolMode
        } = this.elements;

        const server = this._getActiveServer();
        if (!server) return;

        const changed = applyServerFormState(server, {
            name: mcpServerName ? mcpServerName.value : '',
            transport: mcpTransport ? mcpTransport.value : 'sse',
            url: mcpServerUrl ? mcpServerUrl.value : '',
            enabled: mcpServerEnabled ? mcpServerEnabled.checked === true : true,
            toolMode: mcpToolMode ? mcpToolMode.value : 'all',
        });

        if (changed) {
            this.mcpToolsCache.delete(server.id);
        }
    }

    _loadActiveServerIntoForm() {
        const {
            mcpServerSelect,
            mcpServerName,
            mcpTransport,
            mcpServerUrl,
            mcpServerEnabled,
            mcpToolMode
        } = this.elements;

        const server = this._getActiveServer();
        if (!server) return;

        const formState = getServerFormState(server, (transport) => this._getDefaultUrlForTransport(transport));
        if (mcpServerSelect) mcpServerSelect.value = formState.id;
        if (mcpServerName) mcpServerName.value = formState.name;
        if (mcpTransport) mcpTransport.value = formState.transport;
        if (mcpServerUrl) mcpServerUrl.value = formState.url;
        if (mcpServerUrl) mcpServerUrl.placeholder = formState.urlPlaceholder;
        if (mcpServerEnabled) mcpServerEnabled.checked = formState.enabled;
        if (mcpToolMode) mcpToolMode.value = formState.toolMode;

        this._renderToolsUI();
    }

    _renderMcpServerOptions() {
        const { mcpServerSelect } = this.elements;
        if (!mcpServerSelect) return;

        const active = this._getActiveServer();
        if (active) this.mcpActiveServerId = active.id;

        const options = buildServerOptions(this.mcpServers);
        mcpServerSelect.innerHTML = '';
        for (const option of options) {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            mcpServerSelect.appendChild(opt);
        }

        if (active) mcpServerSelect.value = active.id;
    }

    setMcpTestStatus(text, isError = false) {
        const { mcpTestStatus } = this.elements;
        if (!mcpTestStatus) return;
        mcpTestStatus.textContent = text || '';
        mcpTestStatus.style.color = isError ? '#b00020' : '';
    }

    _serverKey(server) {
        return getServerKey(server);
    }

    _getCachedTools(server) {
        return getCachedTools(this.mcpToolsCache, server);
    }

    setMcpToolsList(serverId, transport, url, tools) {
        const id = serverId || (this._getActiveServer() ? this._getActiveServer().id : null);
        if (!id) return;

        setCachedTools(this.mcpToolsCache, id, transport, url, tools);

        this.setMcpTestStatus('');
        this._renderToolsUI();
    }

    _renderToolsUI() {
        const { mcpToolsSummary, mcpToolList, mcpToolSearch } = this.elements;
        const server = this._getActiveServer();
        if (!server || !mcpToolList || !mcpToolsSummary) return;

        const cached = this._getCachedTools(server) || [];
        const uiState = this._getToolsUiState(server.id);

        renderToolsList({
            listEl: mcpToolList,
            summaryEl: mcpToolsSummary,
            server,
            cachedTools: cached,
            searchValue: mcpToolSearch ? mcpToolSearch.value : '',
            uiState,
            onEnabledToolsChange: (enabledTools) => {
                server.enabledTools = enabledTools;
                this._renderToolsUI();
            },
        });
    }

    _getToolsUiState(serverId) {
        return getToolsUiState(this.mcpToolsUiState, serverId);
    }
}
