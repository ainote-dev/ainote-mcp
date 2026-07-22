/**
 * RFC 8628 Device Authorization Grant — CLI client.
 *
 * Talks to the ainote backend endpoints:
 *   POST /api/auth/cli/device/start
 *   POST /api/auth/cli/device/poll
 *   POST /api/auth/cli/device/cancel
 *
 * Per the plan, the server returns 200 + JSON body with a `status` field for
 * polling state (authorization_pending, slow_down, access_denied, expired_token,
 * invalid_grant) and a token payload (no `status`) on success. We never use
 * HTTP error codes for polling state.
 */
import crypto from 'node:crypto';
import axios from 'axios';

export class DeviceFlowError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DeviceFlowError';
    this.code = code;
  }
}

export class DeviceAccessDeniedError extends DeviceFlowError {
  constructor(message = 'Authorization was denied by the user.') {
    super(message, 'access_denied');
    this.name = 'DeviceAccessDeniedError';
  }
}

export class DeviceExpiredError extends DeviceFlowError {
  constructor(message = 'Device code expired before authorization completed.') {
    super(message, 'expired_token');
    this.name = 'DeviceExpiredError';
  }
}

export class DevicePkceError extends DeviceFlowError {
  constructor(message = 'PKCE verification failed (invalid_grant).') {
    super(message, 'invalid_grant');
    this.name = 'DevicePkceError';
  }
}

export class DeviceNetworkError extends DeviceFlowError {
  constructor(message, cause) {
    super(message, 'network_error');
    this.name = 'DeviceNetworkError';
    this.cause = cause;
  }
}

function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Request a device + user code from the server.
 *
 * @param {Object} args
 * @param {string} args.apiUrl - API base URL (no trailing slash).
 * @param {string} args.clientName - Friendly client identifier (e.g. "ainote-mcp CLI").
 * @param {string[]|string} [args.scopes] - Requested scopes.
 * @returns {Promise<{device_code: string, user_code: string, verification_uri: string,
 *   verification_uri_complete?: string, expires_in: number, interval: number,
 *   code_verifier: string}>}
 */
export async function requestDeviceCode({ apiUrl, clientName, scopes }) {
  const { verifier, challenge } = generatePkce();

  const body = {
    client_name: clientName,
    scopes,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  };

  let response;
  try {
    response = await axios.post(`${apiUrl}/api/auth/cli/device/start`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
  } catch (error) {
    if (error.response) {
      const data = error.response.data;
      const msg = (data && (data.error_description || data.error || data.message)) ||
        `Device authorization request failed (HTTP ${error.response.status}).`;
      throw new DeviceFlowError(msg, 'start_failed');
    }
    throw new DeviceNetworkError(`Could not reach ${apiUrl}: ${error.message}`, error);
  }

  // The ainote backend wraps API responses in a standard envelope
  // ({ success, status:'success', data: <payload>, meta }) — see render_success.
  // RFC 8628 device endpoints live behind that envelope, so unwrap before reading.
  const raw = response.data || {};
  const data = (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object')
    ? raw.data
    : raw;

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new DeviceFlowError('Malformed response from device/start: missing required fields.', 'invalid_response');
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    verification_uri_complete: data.verification_uri_complete,
    expires_in: Number(data.expires_in) || 900,
    interval: Number(data.interval) || 5,
    code_verifier: verifier
  };
}

/**
 * Poll the device/poll endpoint until terminal state.
 *
 * The server returns HTTP 200 with a body whose shape signals state:
 *   - `{ error: 'authorization_pending' }`   → keep waiting
 *   - `{ error: 'slow_down', interval?: n }` → bump interval by 5s and wait
 *   - `{ error: 'access_denied' }`           → throw DeviceAccessDeniedError
 *   - `{ error: 'expired_token' }`           → throw DeviceExpiredError
 *   - `{ error: 'invalid_grant' }`           → throw DevicePkceError
 *   - `{ access_token, ... }`                → success, resolve token bundle
 *
 * The ainote backend wraps these in `{ success, status:'success', data: <body>, meta }`,
 * so we unwrap `response.data.data` when present.
 *
 * If the server ever does return non-2xx, we attempt to map the body shape
 * the same way (RFC 8628 §3.5 permits 400 + error JSON, but our backend per
 * the plan returns 200; we tolerate both).
 *
 * @param {Object} args
 * @param {string} args.apiUrl
 * @param {string} args.deviceCode
 * @param {string} args.codeVerifier - PKCE verifier captured during start.
 * @param {number} args.interval - Initial poll interval in seconds.
 * @param {number} args.expiresIn - Total lifetime in seconds.
 * @param {(info: {elapsed: number, interval: number}) => void} [args.onTick]
 * @returns {Promise<{access_token: string, refresh_token?: string, mcp_key?: string,
 *   expires_in?: number, user?: Object, scope?: string}>}
 */
export async function pollForToken({
  apiUrl,
  deviceCode,
  codeVerifier,
  interval,
  expiresIn,
  onTick
}) {
  let currentInterval = Math.max(1, Number(interval) || 5);
  const totalBudget = Math.max(1, Number(expiresIn) || 900);
  const startedAt = Date.now();

  while (true) {
    const elapsedBeforeWait = Math.floor((Date.now() - startedAt) / 1000);

    if (elapsedBeforeWait >= totalBudget) {
      throw new DeviceExpiredError();
    }

    if (typeof onTick === 'function') {
      try {
        onTick({ elapsed: elapsedBeforeWait, interval: currentInterval });
      } catch { /* swallow UX callback errors */ }
    }

    await sleep(currentInterval);

    const elapsedAfterWait = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsedAfterWait >= totalBudget) {
      throw new DeviceExpiredError();
    }

    let body;
    try {
      const response = await axios.post(
        `${apiUrl}/api/auth/cli/device/poll`,
        { device_code: deviceCode, code_verifier: codeVerifier },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          // Per the plan the server returns 200 with status. Don't throw on
          // 4xx so we can read the body uniformly.
          validateStatus: (s) => s >= 200 && s < 500
        }
      );
      const raw = response.data || {};
      // Unwrap ainote API envelope ({ success, data: <payload>, meta }) if present.
      body = (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object')
        ? raw.data
        : raw;
    } catch (error) {
      // Network/5xx — transient. Wait and retry rather than fail the whole flow.
      // But if we're out of budget, give up.
      if (Math.floor((Date.now() - startedAt) / 1000) >= totalBudget) {
        throw new DeviceExpiredError();
      }
      continue;
    }

    // RFC 8628 §3.5 + ainote service: polling state lives in `error`, success has no `error`.
    // Also accept legacy `status` field for forward-compat with any wrapper changes.
    const pollState = body.error || body.status;

    if (!pollState && body.access_token) {
      return {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        mcp_key: body.mcp_key,
        expires_in: body.expires_in,
        scope: body.scope,
        user: body.user
      };
    }

    switch (pollState) {
      case 'authorization_pending':
        continue;
      case 'slow_down': {
        const serverInterval = Number(body.interval);
        if (Number.isFinite(serverInterval) && serverInterval > currentInterval) {
          currentInterval = serverInterval;
        } else {
          currentInterval += 5;
        }
        continue;
      }
      case 'access_denied':
        throw new DeviceAccessDeniedError(body.error_description);
      case 'expired_token':
        throw new DeviceExpiredError(body.error_description);
      case 'invalid_grant':
        throw new DevicePkceError(body.error_description);
      default: {
        const message = body.error_description ||
          body.error ||
          body.message ||
          `Unexpected poll response: ${JSON.stringify(body).slice(0, 200)}`;
        throw new DeviceFlowError(message, pollState || 'unknown');
      }
    }
  }
}

/**
 * Best-effort cancellation. Failures are swallowed — the server will GC
 * the pending request via TTL anyway.
 */
export async function cancel({ apiUrl, deviceCode }) {
  if (!deviceCode) return;
  try {
    await axios.post(
      `${apiUrl}/api/auth/cli/device/cancel`,
      { device_code: deviceCode },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
        validateStatus: () => true
      }
    );
  } catch {
    // intentionally ignored
  }
}
