import axios from 'axios';
import { getConfig } from '../core/config-manager.js';

function buildHeaders(authContext, config) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const contextType = authContext?.type ?? 'mcpKey';

  if (contextType === 'oauth') {
    const bearerToken = authContext?.token;
    if (!bearerToken) {
      throw new Error('OAuth authentication requires a bearer token');
    }
    headers.Authorization = `Bearer ${bearerToken}`;
  } else {
    const apiKey = authContext?.apiKey ?? config.api.key;
    if (!apiKey) {
      throw new Error('AINOTE_API_KEY environment variable is required for MCP authentication');
    }
    headers.Authorization = `McpKey ${apiKey}`;
  }

  return headers;
}

export function createApiClient(authContext) {
  const config = getConfig();
  const headers = buildHeaders(authContext, config);

  return axios.create({
    baseURL: config.api.url,
    headers
  });
}
