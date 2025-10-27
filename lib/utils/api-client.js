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

let requestIdCounter = 1;

/**
 * JSON-RPC 2.0 요청 생성 헬퍼
 */
function createJsonRpcRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: requestIdCounter++,
    method,
    params
  };
}

/**
 * JSON-RPC 2.0 tools/call 요청 생성
 */
function createToolCallRequest(toolName, arguments_) {
  return createJsonRpcRequest('tools/call', {
    name: toolName,
    arguments: arguments_
  });
}

export function createApiClient(authContext) {
  const config = getConfig();
  const headers = buildHeaders(authContext, config);

  const axiosInstance = axios.create({
    baseURL: config.api.url,
    headers
  });

  // JSON-RPC helper 메서드 추가
  axiosInstance.callTool = async (toolName, arguments_) => {
    const rpcRequest = createToolCallRequest(toolName, arguments_);
    const response = await axiosInstance.post('/api/mcp', rpcRequest);

    if (response.data.error) {
      throw new Error(`JSON-RPC Error [${response.data.error.code}]: ${response.data.error.message}`);
    }

    return response.data.result;
  };

  return axiosInstance;
}
