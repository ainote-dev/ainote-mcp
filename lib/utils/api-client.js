import axios from 'axios';
import { getConfig } from '../core/config-manager.js';

const LOGIN_HINT = 'Please run `ainote-mcp login` to re-authenticate.';

function buildHeaders(authContext, config) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const contextType = authContext?.type ?? 'mcpKey';

  if (contextType === 'anonymous') {
    // No auth headers for anonymous mode (onboarding tools)
    return headers;
  }

  if (contextType === 'oauth') {
    const bearerToken = authContext?.token;
    if (!bearerToken) {
      throw new Error('OAuth authentication requires a bearer token');
    }
    headers.Authorization = `Bearer ${bearerToken}`;
  } else {
    const apiKey = authContext?.apiKey ?? config.api.key;
    if (!apiKey) {
      throw new Error(`AINOTE_API_KEY environment variable is required for MCP authentication. ${LOGIN_HINT}`);
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

function isBearerAuth(authContext) {
  return authContext?.type === 'oauth';
}

async function tryRefreshAndUpdateHeaders(axiosInstance, config) {
  // Only Bearer (access_token) flows can refresh. mcp_key flows cannot.
  try {
    const { refreshAccessToken } = await import('../auth/refresh.js');
    const { getCredentials, setCredentials, clearCredentials } = await import('../auth/token-store.js');
    const creds = await getCredentials(config.api.url);
    if (!creds || !creds.refreshToken) {
      return { refreshed: false, reason: 'no_refresh_token' };
    }
    const fresh = await refreshAccessToken({ apiUrl: config.api.url, refreshToken: creds.refreshToken });
    const expiresAt = fresh.expires_in ? Date.now() + fresh.expires_in * 1000 : undefined;
    await setCredentials(config.api.url, {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt
    });
    axiosInstance.defaults.headers.common.Authorization = `Bearer ${fresh.access_token}`;
    return { refreshed: true };
  } catch (err) {
    try {
      const { clearCredentials } = await import('../auth/token-store.js');
      await clearCredentials(config.api.url);
    } catch { /* ignore */ }
    return { refreshed: false, reason: err.message };
  }
}

export function createApiClient(authContext) {
  const config = getConfig();
  const headers = buildHeaders(authContext, config);

  const axiosInstance = axios.create({
    baseURL: config.api.url,
    headers
  });

  // Intercept 401s on bearer-authed requests and try one refresh + retry.
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const originalRequest = error.config || {};
      if (status !== 401 || originalRequest._retriedRefresh) {
        return Promise.reject(error);
      }

      // Determine which auth scheme was in play for the original request.
      const sentAuth = originalRequest.headers?.Authorization || originalRequest.headers?.authorization || '';
      const isBearer = isBearerAuth(authContext) || /^Bearer\s/i.test(sentAuth);
      const isMcpKey = /^McpKey\s/i.test(sentAuth);

      if (isBearer) {
        const result = await tryRefreshAndUpdateHeaders(axiosInstance, config);
        if (result.refreshed) {
          originalRequest._retriedRefresh = true;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: axiosInstance.defaults.headers.common.Authorization
          };
          return axiosInstance.request(originalRequest);
        }
        const wrapped = new Error(`Authentication failed and refresh was not possible. ${LOGIN_HINT}`);
        wrapped.cause = error;
        return Promise.reject(wrapped);
      }

      if (isMcpKey) {
        const wrapped = new Error(`MCP key was rejected by the server. ${LOGIN_HINT}`);
        wrapped.cause = error;
        return Promise.reject(wrapped);
      }

      return Promise.reject(error);
    }
  );

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
