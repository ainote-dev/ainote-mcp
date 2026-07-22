import { getConfig } from '../core/config.js';

/**
 * Synchronous variant: only consults env var. Kept for callers that cannot
 * await (e.g. the stdio bootstrap path that hasn't loaded the async config).
 */
export function authenticateWithMcpKey() {
  const config = getConfig();

  if (!config.api.key) {
    throw new Error('AINOTE_API_KEY is required to authenticate MCP requests. Run `ainote-mcp login` or set AINOTE_API_KEY.');
  }

  return {
    type: 'mcpKey',
    apiKey: config.api.key
  };
}

/**
 * Async variant: falls back to the local CLI token store (populated by
 * `ainote-mcp login`) when no env var is set.
 */
export async function authenticateWithMcpKeyAsync() {
  const envKey = process.env.AINOTE_API_KEY;
  if (envKey) {
    return { type: 'mcpKey', apiKey: envKey };
  }

  try {
    const { getCredentials } = await import('./token-store.js');
    const baseUrl = process.env.AINOTE_API_URL || 'https://ainote-5muq.onrender.com';
    const creds = await getCredentials(baseUrl);
    if (creds && creds.mcpKey) {
      return { type: 'mcpKey', apiKey: creds.mcpKey };
    }
  } catch { /* fall through */ }

  throw new Error('AINOTE_API_KEY is required to authenticate MCP requests. Run `ainote-mcp login` or set AINOTE_API_KEY.');
}
