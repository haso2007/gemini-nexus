// background/handlers/session/prompt/tool_executor.js
import { parseToolCommand } from '../utils.js';
import { ToolDispatcher } from '../../../control/dispatcher.js';

export class ToolExecutor {
    constructor(controlManager, mcpManager) {
        this.controlManager = controlManager;
        this.mcpManager = mcpManager;
    }

    async executeIfPresent(text, request, onUpdate) {
        const toolCommand = parseToolCommand(text);
        if (!toolCommand) return null;

        const toolName = toolCommand.name;
        onUpdate(`Executing tool: ${toolName}...`, "Processing tool execution...");

        let output = "";
        let files = null;
        let source = "unknown";

        try {
            if (ToolDispatcher.isLocalTool(toolName)) {
                if (!this.controlManager) {
                    throw new Error('Browser control is unavailable.');
                }

                source = "browser_control";
                const execResult = await this.controlManager.execute({
                    name: toolName,
                    args: toolCommand.args || {}
                });

                if (execResult && typeof execResult === 'object' && execResult.image) {
                    output = execResult.text;
                    files = [{
                        base64: execResult.image,
                        type: "image/png",
                        name: "screenshot.png"
                    }];
                } else {
                    output = execResult;
                }
            } else {
                const servers = this.mcpManager ? this.mcpManager.getEnabledServers(request) : [];
                const mcpEnabled = servers.length > 0;

                if (!this.mcpManager || !mcpEnabled) {
                    throw new Error(`Unknown tool '${toolName}'. (External MCP tools are disabled)`);
                }

                source = "mcp_remote";
                let remote;

                const isMultiServerTool = toolName.includes('__');

                if (isMultiServerTool) {
                    remote = await this.mcpManager.callToolById(toolName, toolCommand.args || {}, servers);
                } else {
                    const allTools = await this.mcpManager.listAllActiveTools(servers);
                    const matchingTool = allTools.find(t => t.name === toolName);

                    if (!matchingTool) {
                        throw new Error(`Tool '${toolName}' not found in any enabled MCP server.`);
                    }

                    // Check if tool is enabled for its server
                    const server = servers.find(s => s.id === matchingTool._serverId);
                    if (server && server.toolMode === 'selected') {
                        const enabled = Array.isArray(server.enabledTools) ? new Set(server.enabledTools) : new Set();
                        if (!enabled.has(toolName)) {
                            throw new Error(`External MCP tool '${toolName}' is disabled (not in selected tools).`);
                        }
                    }

                    remote = await this.mcpManager.callToolById(matchingTool._toolId, toolCommand.args || {}, servers);
                }

                output = remote.text;
                files = remote.files && remote.files.length ? remote.files : null;
            }
        } catch (err) {
            output = `Error executing tool: ${err.message}`;
        }

        return {
            toolName,
            output,
            files,
            source
        };
    }
}
