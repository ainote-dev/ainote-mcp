import axios from 'axios';
import { getConfig } from '../core/config-manager.js';
import { toErrorContent } from './internal/formatters.js';

/**
 * Onboarding tools for signup/login without API key.
 * These tools call the Rails API directly (no auth headers).
 */

function signupDefinition() {
  return {
    name: 'signup_and_get_key',
    description: `Create a new AI Note account and get an MCP API key. No authentication required.
Use this if you don't have an account yet. After getting the key, add it to your MCP config and restart.`,
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address for the new account' },
        password: { type: 'string', description: 'Password (minimum 6 characters)' },
        name: { type: 'string', description: 'Display name (optional)' }
      },
      required: ['email', 'password']
    }
  };
}

function loginDefinition() {
  return {
    name: 'login_and_get_key',
    description: `Log in to an existing AI Note account and get an MCP API key. No authentication required.
Use this if you already have an account but need your MCP key.`,
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Your account email address' },
        password: { type: 'string', description: 'Your account password' }
      },
      required: ['email', 'password']
    }
  };
}

function setupGuideDefinition() {
  return {
    name: 'get_setup_guide',
    description: 'Get instructions for setting up AI Note MCP in Claude Desktop, Cursor, or other MCP clients. Includes CLI signup method (npx @ainote/mcp signup). No authentication required.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  };
}

/**
 * Call Rails MCP API directly without auth headers (for onboarding tools).
 */
async function callOnboardingTool(toolName, args = {}) {
  const config = getConfig();
  const rpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  };

  const response = await axios.post(`${config.api.url}/api/mcp`, rpcRequest, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  if (response.data?.data?.error) {
    const err = response.data.data.error;
    throw new Error(err.message || 'Onboarding tool call failed');
  }

  // Rails wraps in { success: true, data: { jsonrpc, id, result } }
  const rpcResult = response.data?.data?.result;
  if (rpcResult) {
    return rpcResult;
  }

  // Fallback: return the raw response content
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(response.data, null, 2)
    }]
  };
}

export function getOnboardingTools() {
  return [
    {
      definition: signupDefinition(),
      handler: async (args) => {
        try {
          return await callOnboardingTool('signup_and_get_key', args);
        } catch (error) {
          return toErrorContent(error);
        }
      }
    },
    {
      definition: loginDefinition(),
      handler: async (args) => {
        try {
          return await callOnboardingTool('login_and_get_key', args);
        } catch (error) {
          return toErrorContent(error);
        }
      }
    },
    {
      definition: setupGuideDefinition(),
      handler: async () => {
        try {
          return await callOnboardingTool('get_setup_guide');
        } catch (error) {
          return toErrorContent(error);
        }
      }
    }
  ];
}
