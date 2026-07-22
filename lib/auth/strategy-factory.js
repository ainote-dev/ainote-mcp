import { authenticateWithMcpKey } from './mcp-key.js';
import { authenticateWithOAuth } from './oauth.js';
import { getFeatureFlags } from '../core/config.js';

export function resolveAuthContext(transportType, headers = {}) {
  if (transportType === 'stdio') {
    try {
      return authenticateWithMcpKey();
    } catch {
      // No API key configured — allow anonymous mode for onboarding tools
      return { type: 'anonymous' };
    }
  }

  const features = getFeatureFlags();

  if (transportType === 'sse' && features.oauthAuth) {
    try {
      return authenticateWithOAuth(headers);
    } catch {
      // Fall through to MCP key or anonymous
    }
  }

  // Default fallback to MCP key, then anonymous for onboarding
  try {
    return authenticateWithMcpKey();
  } catch {
    return { type: 'anonymous' };
  }
}
