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
    features
  };
}

export function getFeatureFlags() {
  return getConfig().features;
}
