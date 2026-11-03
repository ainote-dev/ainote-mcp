import { errorMessage } from '../../lib/auth/error-message.js';

describe('errorMessage', () => {
  test.each([
    [{ error: { message: 'boom', code: 'X' } }, 'boom'],
    [{ error: 'invalid_grant', error_description: 'expired' }, 'expired'],
    [{ error: 'access_denied' }, 'access_denied'],
    [{ message: 'plain' }, 'plain'],
    [{ error: { code: 'X' } }, undefined],
    [null, undefined],
    ['text', undefined]
  ])('%j -> %s', (body, expected) => {
    expect(errorMessage(body)).toBe(expected);
  });
});
