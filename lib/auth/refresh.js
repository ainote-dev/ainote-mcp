/**
 * Access token rotation against the ainote backend.
 *
 * Endpoint: POST /api/auth/token/refresh
 * Body:     { refresh_token: "rt_..." }
 * Response: { success, data: { access_token, refresh_token, expires_in } }
 *           (legacy: same fields at the top level)
 *
 * Concurrency: an in-process mutex (module-level Promise) ensures that
 * parallel callers wait on a single in-flight refresh instead of issuing
 * duplicate requests (which would otherwise burn through refresh-token
 * rotation and invalidate the family).
 */
import axios from 'axios';
import { errorMessage } from './error-message.js';

let inFlight = null;

export class RefreshError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'RefreshError';
    this.status = status;
    this.body = body;
  }
}

async function performRefresh({ apiUrl, refreshToken }) {
  let response;
  try {
    response = await axios.post(
      `${apiUrl}/api/auth/token/refresh`,
      { refresh_token: refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (s) => s >= 200 && s < 500
      }
    );
  } catch (err) {
    throw new RefreshError(`Refresh request failed: ${err.message}`);
  }

  if (response.status < 200 || response.status >= 300) {
    const body = response.data || {};
    const msg = errorMessage(body) ||
      `Refresh failed with HTTP ${response.status}`;
    throw new RefreshError(msg, { status: response.status, body });
  }

  const body = response.data || {};
  // Server wraps the payload as { success, data: { access_token, ... } };
  // older servers returned the fields at the top level.
  const accessToken = body.data?.access_token ?? body.access_token;
  const nextRefreshToken = body.data?.refresh_token ?? body.refresh_token;
  const expiresIn = body.data?.expires_in ?? body.expires_in;
  if (!accessToken) {
    throw new RefreshError('Refresh response missing access_token', { body });
  }
  return {
    access_token: accessToken,
    refresh_token: nextRefreshToken || refreshToken,
    expires_in: Number(expiresIn) || undefined
  };
}

/**
 * Rotate the access token. Concurrent callers share one in-flight request.
 *
 * @param {Object} args
 * @param {string} args.apiUrl
 * @param {string} args.refreshToken
 * @returns {Promise<{access_token: string, refresh_token: string, expires_in?: number}>}
 */
export async function refreshAccessToken({ apiUrl, refreshToken }) {
  if (!refreshToken) {
    throw new RefreshError('No refresh token available — login required.');
  }
  if (inFlight) return inFlight;
  inFlight = performRefresh({ apiUrl, refreshToken })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
