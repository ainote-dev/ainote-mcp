/**
 * `ainote-mcp whoami` — show the currently authenticated user.
 *
 * Strategy:
 *   1. Read credentials from the token store.
 *   2. If we have an access_token, hit GET /api/users/me with Bearer auth and
 *      print the response.
 *   3. If the API call fails (404, 401, network) but we have a stored mcp_key,
 *      print a minimal local-only summary so the user at least sees that
 *      credentials exist for this host.
 */
import process from 'node:process';
import axios from 'axios';
import { getCredentials } from '../auth/token-store.js';

const DEFAULT_API_URL = 'https://ainote-5muq.onrender.com';

function summarizeUser(user) {
  if (!user || typeof user !== 'object') return null;
  const parts = [];
  if (user.email) parts.push(user.email);
  else if (user.name) parts.push(user.name);
  else if (user.id) parts.push(`user #${user.id}`);
  return parts.join(' ');
}

export async function run() {
  const apiUrl = (process.env.AINOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  const creds = await getCredentials(apiUrl);

  if (!creds) {
    console.error('  Not logged in. Run `ainote-mcp login`.');
    process.exit(1);
    return;
  }

  let identity = null;

  if (creds.accessToken) {
    try {
      const response = await axios.get(`${apiUrl}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true
      });
      if (response.status >= 200 && response.status < 300) {
        const body = response.data || {};
        identity = summarizeUser(body.user || body.data || body) || summarizeUser(body);
      }
    } catch {
      // fall through to local-only fallback below
    }
  }

  if (identity) {
    console.log(`  Logged in as ${identity}`);
  } else {
    // Local-only fallback: report what we have.
    const host = (() => {
      try { return new URL(apiUrl).host; } catch { return apiUrl; }
    })();
    console.log(`  Credentials present for ${host}`);
    if (creds.mcpKey) console.log(`  MCP key: ${creds.mcpKey.slice(0, 8)}…`);
    if (creds.expiresAt) {
      const remaining = Math.floor((creds.expiresAt - Date.now()) / 1000);
      if (remaining > 0) console.log(`  Access token expires in ~${remaining}s`);
      else console.log(`  Access token expired (refresh on next call).`);
    }
    if (!creds.accessToken && !creds.mcpKey) {
      console.error('  Could not verify identity. Try `ainote-mcp login` again.');
      process.exit(1);
    }
  }
}
