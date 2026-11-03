/**
 * refreshAccessToken must read the server's wrapped response.
 *
 * ainote_server renders POST /api/auth/token/refresh through render_success,
 * so the tokens arrive as { success, status, data: { access_token, ... } }.
 * 1.3.4 read only the top level and threw "missing access_token" on every
 * refresh, forcing `ainote-mcp login` users to log in again.
 */
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { refreshAccessToken, RefreshError } from '../../lib/auth/refresh.js';

const API = 'https://api.example.test';
const URL = `${API}/api/auth/token/refresh`;

describe('refreshAccessToken', () => {
  let mock;
  beforeEach(() => { mock = new MockAdapter(axios); });
  afterEach(() => { mock.restore(); });

  test('reads tokens from the wrapped { success, data } response', async () => {
    mock.onPost(URL).reply(200, {
      success: true,
      status: 'success',
      data: { access_token: 'at_new', refresh_token: 'rt_new', expires_in: 3600 }
    });
    await expect(refreshAccessToken({ apiUrl: API, refreshToken: 'rt_old' }))
      .resolves.toEqual({ access_token: 'at_new', refresh_token: 'rt_new', expires_in: 3600 });
  });

  test('still accepts the legacy top-level response', async () => {
    mock.onPost(URL).reply(200, { access_token: 'at_new', expires_in: 60 });
    await expect(refreshAccessToken({ apiUrl: API, refreshToken: 'rt_old' }))
      .resolves.toEqual({ access_token: 'at_new', refresh_token: 'rt_old', expires_in: 60 });
  });

  test('rejects a success response without an access token', async () => {
    mock.onPost(URL).reply(200, { success: true, data: {} });
    await expect(refreshAccessToken({ apiUrl: API, refreshToken: 'rt_old' }))
      .rejects.toBeInstanceOf(RefreshError);
  });
});
