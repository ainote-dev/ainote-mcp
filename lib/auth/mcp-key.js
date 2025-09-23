import { getConfig } from '../core/config.js';

export function authenticateWithMcpKey() {
  const config = getConfig();

  if (!config.api.key) {
    throw new Error('AINOTE_API_KEY is required to authenticate MCP requests');
  }

  return {
    type: 'mcpKey',
    apiKey: config.api.key
  };
}
