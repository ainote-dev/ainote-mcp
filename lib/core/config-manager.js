/**
 * Single source of truth for the default AI Note backend URL.
 *
 * Every entry point (MCP server, `login`, `logout`, `whoami`, `call`) must
 * resolve the API URL through resolveApiUrl(). Credentials written by
 * `ainote-mcp login` are namespaced by API host in the token store, so any
 * divergence here makes the other commands look up the wrong host.
 *
 * The backend moved off Render (2026-11); the old Render host now answers 503.
 * api.ainote.dev is the canonical domain, matching the iOS and Android apps.
 */
export const DEFAULT_API_URL = 'https://api.ainote.dev';

/**
 * Hosts that used to serve the API. A URL on one of these is rewritten to
 * DEFAULT_API_URL (path kept), so configs that pinned the old host via
 * AINOTE_API_URL keep working, and the token store can still find
 * credentials saved under them.
 */
export const LEGACY_API_HOSTS = ['ainote-5muq.onrender.com'];

function rewriteLegacyHost(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (!LEGACY_API_HOSTS.includes(parsed.host)) return raw;
  const target = new URL(DEFAULT_API_URL);
  parsed.protocol = target.protocol;
  parsed.host = target.host;
  return parsed.toString();
}

/**
 * Resolve the effective API base URL: AINOTE_API_URL env override, else the
 * default. A legacy host is rewritten to the default host. Trailing slashes
 * are stripped so "${url}/api/..." joins cleanly.
 */
export function resolveApiUrl(env = process.env) {
  const raw = env.AINOTE_API_URL || DEFAULT_API_URL;
  return rewriteLegacyHost(raw).replace(/\/+$/, '');
}

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
      url: resolveApiUrl()
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
