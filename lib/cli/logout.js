/**
 * `ainote-mcp logout` — revoke server-side tokens and clear local credentials.
 */
import process from 'node:process';
import axios from 'axios';
import { getCredentials, clearCredentials } from '../auth/token-store.js';

const DEFAULT_API_URL = 'https://ainote-5muq.onrender.com';

export async function run() {
  const apiUrl = (process.env.AINOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

  const creds = await getCredentials(apiUrl);

  if (!creds) {
    console.log('  No credentials found. Already logged out.');
    return;
  }

  if (creds.refreshToken) {
    try {
      await axios.post(
        `${apiUrl}/api/auth/token/revoke`,
        { refresh_token: creds.refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          validateStatus: () => true
        }
      );
    } catch (err) {
      // Server-side revoke is best-effort. Continue with local clear.
      process.stderr.write(`[ainote-mcp] Server revoke failed (continuing): ${err.message}\n`);
    }
  }

  await clearCredentials(apiUrl);
  console.log('  Logged out.');
}
