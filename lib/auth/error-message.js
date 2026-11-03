/**
 * Pull a human-readable message out of an ainote error body.
 *
 * OAuth-style endpoints send `error`/`error_description` strings, while the
 * API's render_error sends `{ success: false, error: { message, code } }`.
 * Reading `error` as a string turned the latter into "[object Object]".
 *
 * @param {unknown} body
 * @returns {string|undefined}
 */
export function errorMessage(body) {
  if (!body || typeof body !== 'object') return undefined;
  const { error, error_description: description, message } = body;
  if (typeof description === 'string' && description) return description;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  if (typeof message === 'string' && message) return message;
  return undefined;
}
