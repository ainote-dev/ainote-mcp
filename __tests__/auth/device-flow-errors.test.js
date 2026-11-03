/**
 * Device-login errors from the API envelope must show the server message,
 * not "[object Object]".
 */
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { requestDeviceCode } from '../../lib/auth/device-flow.js';

const API_URL = 'https://test.api.ainote.dev';

describe('device-flow error messages', () => {
  let mock;
  beforeEach(() => { mock = new MockAdapter(axios); });
  afterEach(() => { mock.restore(); });

  test('device/start failure uses error.message from the envelope', async () => {
    mock.onPost(`${API_URL}/api/auth/cli/device/start`).reply(429, {
      success: false,
      error: { message: 'Too many requests', code: 'RATE_LIMITED' }
    });
    await expect(requestDeviceCode({ apiUrl: API_URL, clientName: 'test' }))
      .rejects.toMatchObject({ name: 'DeviceFlowError', message: 'Too many requests' });
  });
});
