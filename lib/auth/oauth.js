export function authenticateWithOAuth(headers = {}) {
  const authHeader = headers['authorization'] || headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Bearer token for OAuth authentication');
  }

  const token = authHeader.substring('Bearer '.length).trim();

  if (!token) {
    throw new Error('Bearer token is empty');
  }

  return {
    type: 'oauth',
    token
  };
}
