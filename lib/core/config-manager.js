const DEFAULT_API_URL = 'https://ainote-5muq.onrender.com';
const DEFAULT_HTTP_PORT = 3030;

const parseBoolean = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = `${value}`.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseNumber = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

/**
 * Synchronous config snapshot. Reads env vars only — used by the JSON-RPC
 * stdio entry path that cannot await.
 *
 * Note: stored CLI credentials (mcp_key from `ainote-mcp login`) are loaded
 * asynchronously by `getConfigAsync()` below. Callers that can await should
 * prefer the async form.
 */
export function getConfig() {
  const features = {
    chatgptSupport: parseBoolean(process.env.AINOTE_ENABLE_CHATGPT_SUPPORT, true),
    oauthAuth: parseBoolean(process.env.AINOTE_ENABLE_OAUTH_AUTH, false),
    sseTransport: parseBoolean(process.env.AINOTE_ENABLE_SSE_TRANSPORT, true)
  };

  return {
    api: {
      key: process.env.AINOTE_API_KEY,
      url: process.env.AINOTE_API_URL || DEFAULT_API_URL
    },
    http: {
      port: parseNumber(process.env.AINOTE_MCP_HTTP_PORT, DEFAULT_HTTP_PORT),
      endpoint: process.env.AINOTE_MCP_HTTP_ENDPOINT || '/sse',
      messageEndpoint: process.env.AINOTE_MCP_HTTP_MESSAGES_ENDPOINT || '/messages',
      allowedOrigins: parseList(process.env.AINOTE_MCP_ALLOWED_ORIGINS),
      allowedHosts: parseList(process.env.AINOTE_MCP_ALLOWED_HOSTS)
    },
    features,
    requiresLogin: !process.env.AINOTE_API_KEY
  };
}

/**
 * Async config that consults the local token store for an mcp_key when the
 * environment variable is unset. Used by the stdio entry path that runs
 * `await getConfigAsync()` at startup.
 */
export async function getConfigAsync() {
  const base = getConfig();

  if (base.api.key) {
    return { ...base, requiresLogin: false };
  }

  try {
    const { getCredentials } = await import('../auth/token-store.js');
    const creds = await getCredentials(base.api.url);
    if (creds && creds.mcpKey) {
      return {
        ...base,
        api: { ...base.api, key: creds.mcpKey },
        requiresLogin: false,
        api_key_source: 'token-store'
      };
    }
  } catch (err) {
    process.stderr.write(`[ainote-mcp] token store unavailable: ${err.message}\n`);
  }

  return { ...base, requiresLogin: true };
}

export function getFeatureFlags() {
  return getConfig().features;
}
