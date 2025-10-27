import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './tool-registry.js';
import { getConfig } from './config-manager.js';
import { createApiClient } from '../utils/api-client.js';
import { getSharedTools } from '../tools/shared-tools.js';
import { getChatGptTools } from '../tools/chatgpt-tools.js';
import { toErrorContent } from '../tools/internal/formatters.js';

function buildServerInfo(profile) {
  return {
    name: `ainote-mcp-${profile}`,
    version: '1.1.0'
  };
}

function registerTools(registry, { includeChatGpt }) {
  registry.registerMany(getSharedTools());

  if (includeChatGpt) {
    registry.registerMany(getChatGptTools());
  }
}

function createServer({ profile, defaultAuthContext } = {}) {
  const config = getConfig();
  const includeChatGpt = profile === 'chatgpt' && config.features.chatgptSupport;
  const registry = new ToolRegistry();

  registerTools(registry, { includeChatGpt });

  const server = new Server(buildServerInfo(profile), {
    capabilities: {
      tools: {}
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listDefinitions()
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const { name, arguments: args } = request.params;
      console.error(`[MCP] Calling tool: ${name}`, JSON.stringify(args));

      const authContext = extra?.authInfo ?? defaultAuthContext;
      const apiClient = createApiClient(authContext);

      const result = await registry.execute(name, args, {
        apiClient,
        request,
        extra
      });

      console.error(`[MCP] Tool ${name} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[MCP] Tool error:`, error);
      return toErrorContent(error);
    }
  });

  return { server, registry };
}

export function createClaudeServer(options = {}) {
  return createServer({ profile: 'claude', ...options });
}

export function createChatGptServer(options = {}) {
  return createServer({ profile: 'chatgpt', ...options });
}

export function createServerForProfile(profile, options = {}) {
  return createServer({ profile, ...options });
}
