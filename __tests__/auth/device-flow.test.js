/**
 * Phase 6 — CLI device-flow client tests (RFC 8628).
 *
 * Mocks axios to simulate the backend's polling responses. Uses jest fake
 * timers so the `setTimeout(interval * 1000)` waits inside pollForToken don't
 * make tests slow.
 *
 * NOTE: The backend wraps responses in `{ success, status:'success', data: <body>, meta }`
 * via `render_success`. device-flow.js detects and unwraps that envelope, then
 * reads RFC 8628 fields off the inner body (polling state in `error`, success
 * fields like `access_token` at the top of the inner body).
 */

function envelope(payload) {
  return { success: true, status: 'success', data: payload, meta: {} };
}
import { jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import crypto from 'node:crypto';

import {
  requestDeviceCode,
  pollForToken,
  cancel,
  DeviceAccessDeniedError,
  DeviceExpiredError,
  DevicePkceError
} from '../../lib/auth/device-flow.js';

const API_URL = 'https://test.api.ainote.dev';

/** Drive jest fake timers far enough to release a single `setTimeout(intervalSec * 1000)`. */
async function advanceForInterval(intervalSec) {
  // Tick a hair past the wait, then yield to the microtask queue so axios mock
  // adapter can resolve the next promise.
  await jest.advanceTimersByTimeAsync(intervalSec * 1000 + 10);
}

describe('device-flow.js', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
    jest.useRealTimers();
  });

  describe('requestDeviceCode', () => {
    it('sends a valid S256 PKCE challenge and returns the device-code bundle plus verifier', async () => {
      let capturedBody = null;
      mock.onPost(`${API_URL}/api/auth/cli/device/start`).reply((config) => {
        capturedBody = JSON.parse(config.data);
        return [200, envelope({
          device_code: 'dev-code-xyz',
          user_code: 'BCDF-GHJK',
          verification_uri: `${API_URL}/oauth/cli/device`,
          verification_uri_complete: `${API_URL}/oauth/cli/device?user_code=BCDF-GHJK`,
          expires_in: 900,
          interval: 5
        })];
      });

      const result = await requestDeviceCode({
        apiUrl: API_URL,
        clientName: 'ainote CLI test',
        scopes: ['mcp']
      });

      expect(capturedBody.code_challenge_method).toBe('S256');
      expect(typeof capturedBody.code_challenge).toBe('string');
      // base64url SHA256 → 43 chars no padding
      expect(capturedBody.code_challenge.length).toBe(43);

      // Verifier round-trip: SHA256(verifier) base64url === code_challenge
      const computed = crypto.createHash('sha256').update(result.code_verifier).digest('base64url');
      expect(computed).toBe(capturedBody.code_challenge);

      expect(result.device_code).toBe('dev-code-xyz');
      expect(result.user_code).toBe('BCDF-GHJK');
      expect(result.interval).toBe(5);
      expect(result.expires_in).toBe(900);
    });
  });

  describe('pollForToken', () => {
    it('resolves the token bundle after a pending poll then a success poll', async () => {
      jest.useFakeTimers();

      let call = 0;
      mock.onPost(`${API_URL}/api/auth/cli/device/poll`).reply(() => {
        call += 1;
        if (call === 1) return [200, envelope({ error: 'authorization_pending' })];
        return [200, envelope({
          access_token: 'at_OK',
          refresh_token: 'rt_OK',
          mcp_key: 'mk_OK',
          expires_in: 3600,
          user: { id: 1, email: 'a@b.test' }
        })];
      });

      const promise = pollForToken({
        apiUrl: API_URL,
        deviceCode: 'dc',
        codeVerifier: 'v',
        interval: 1,
        expiresIn: 60
      });

      await advanceForInterval(1); // first wait → pending
      await advanceForInterval(1); // second wait → success
      const result = await promise;

      expect(result.access_token).toBe('at_OK');
      expect(result.mcp_key).toBe('mk_OK');
      expect(result.user).toEqual({ id: 1, email: 'a@b.test' });
      expect(call).toBe(2);
    });

    it('bumps interval by ≥5s when server returns slow_down', async () => {
      jest.useFakeTimers();

      const callTimes = [];
      mock.onPost(`${API_URL}/api/auth/cli/device/poll`).reply(() => {
        callTimes.push(Date.now());
        if (callTimes.length === 1) return [200, envelope({ error: 'slow_down' })];
        if (callTimes.length === 2) return [200, envelope({ error: 'authorization_pending' })];
        return [200, envelope({ access_token: 'at_ok' })];
      });

      const promise = pollForToken({
        apiUrl: API_URL,
        deviceCode: 'dc',
        codeVerifier: 'v',
        interval: 1,
        expiresIn: 300
      });

      await advanceForInterval(1);   // first poll → slow_down (interval becomes 6)
      await advanceForInterval(6);   // bumped wait
      await advanceForInterval(6);   // bumped wait → success
      const result = await promise;

      expect(result.access_token).toBe('at_ok');
      // After slow_down, the gap between poll #1 and poll #2 must be ≥ 6000ms
      // (initial 1s + bump of ≥5s). callTimes are mock fake-timer "Date.now()" reads.
      const gap = callTimes[1] - callTimes[0];
      expect(gap).toBeGreaterThanOrEqual(6000);
    });

    it('throws DeviceAccessDeniedError on access_denied', async () => {
      jest.useFakeTimers();
      mock.onPost(`${API_URL}/api/auth/cli/device/poll`).reply(200, envelope({ error: 'access_denied' }));

      const promise = pollForToken({
        apiUrl: API_URL, deviceCode: 'dc', codeVerifier: 'v', interval: 1, expiresIn: 60
      });
      // Attach rejection assertion BEFORE advancing fake timers so jest doesn't
      // see an unhandled rejection on the same tick the throw fires.
      const assertion = expect(promise).rejects.toBeInstanceOf(DeviceAccessDeniedError);
      await advanceForInterval(1);
      await assertion;
    });

    it('throws DeviceExpiredError on expired_token', async () => {
      jest.useFakeTimers();
      mock.onPost(`${API_URL}/api/auth/cli/device/poll`).reply(200, envelope({ error: 'expired_token' }));

      const promise = pollForToken({
        apiUrl: API_URL, deviceCode: 'dc', codeVerifier: 'v', interval: 1, expiresIn: 60
      });
      const assertion = expect(promise).rejects.toBeInstanceOf(DeviceExpiredError);
      await advanceForInterval(1);
      await assertion;
    });

    it('throws DevicePkceError on invalid_grant', async () => {
      jest.useFakeTimers();
      mock.onPost(`${API_URL}/api/auth/cli/device/poll`).reply(200, envelope({ error: 'invalid_grant' }));

      const promise = pollForToken({
        apiUrl: API_URL, deviceCode: 'dc', codeVerifier: 'v', interval: 1, expiresIn: 60
      });
      const assertion = expect(promise).rejects.toBeInstanceOf(DevicePkceError);
      await advanceForInterval(1);
      await assertion;
    });
  });

  describe('cancel', () => {
    it('posts to /device/cancel and swallows any response', async () => {
      mock.onPost(`${API_URL}/api/auth/cli/device/cancel`).reply(200, { status: 'cancelled' });
      await expect(cancel({ apiUrl: API_URL, deviceCode: 'dc' })).resolves.toBeUndefined();
      expect(mock.history.post.length).toBe(1);
    });

    it('does not throw on network failure', async () => {
      mock.onPost(`${API_URL}/api/auth/cli/device/cancel`).networkError();
      await expect(cancel({ apiUrl: API_URL, deviceCode: 'dc' })).resolves.toBeUndefined();
    });
  });
});
