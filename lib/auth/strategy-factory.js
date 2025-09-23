import { authenticateWithMcpKey } from './mcp-key.js';
import { authenticateWithOAuth } from './oauth.js';
import { getFeatureFlags } from '../core/config.js';

export function resolveAuthContext(transportType, headers = {}) {
  if (transportType === 'stdio') {
    return authenticateWithMcpKey();
  }

  const features = getFeatureFlags();

  if (transportType === 'sse' && features.oauthAuth) {
    return authenticateWithOAuth(headers);
  }

  // Default fallback to MCP key to maintain backward compatibility.
  return authenticateWithMcpKey();
}
