/**
 * Default API URL must be a single source of truth.
 *
 * Credentials written by `ainote-mcp login` are namespaced by API host in the
 * token store, so every entry point (login/logout/whoami/call + MCP server)
 * must resolve the same default. Regression: call.js used to default to
 * https://api.ainote.dev while login stored keys under the Render host, so
 * `ainote-mcp call` failed with "no MCP key" unless AINOTE_API_URL was set.
 */
import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const getCredentials = jest.fn();
jest.unstable_mockModule('../../lib/auth/token-store.js', () => ({
  getCredentials,
  setCredentials: jest.fn(),
  clearCredentials: jest.fn(),
  _credentialsLocations: jest.fn()
}));

const { default: axios } = await import('axios');
const { default: MockAdapter } = await import('axios-mock-adapter');
const { DEFAULT_API_URL, resolveApiUrl, getConfig } = await import('../../lib/core/config-manager.js');
const { run: runCall } = await import('../../lib/cli/call.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, '../../lib/cli');

describe('resolveApiUrl', () => {
  test('falls back to DEFAULT_API_URL when AINOTE_API_URL is unset', () => {
    expect(resolveApiUrl({})).toBe(DEFAULT_API_URL);
  });

  test('honours AINOTE_API_URL override and strips trailing slashes', () => {
    expect(resolveApiUrl({ AINOTE_API_URL: 'https://example.test//' })).toBe('https://example.test');
  });

  test('getConfig().api.url uses the same resolver', () => {
    const saved = process.env.AINOTE_API_URL;
    delete process.env.AINOTE_API_URL;
    try {
      expect(getConfig().api.url).toBe(DEFAULT_API_URL);
    } finally {
      if (saved !== undefined) process.env.AINOTE_API_URL = saved;
    }
  });
});

describe('CLI commands share the default API URL', () => {
  test('no lib/cli module hardcodes its own API base URL', () => {
    for (const file of fs.readdirSync(CLI_DIR).filter((f) => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(CLI_DIR, file), 'utf8');
      expect({ file, hardcoded: /const\s+DEFAULT_API_URL\s*=/.test(src) })
        .toEqual({ file, hardcoded: false });
    }
  });

  describe('call', () => {
    let mock;
    let savedEnv;
    let exitSpy;
    let logSpy;

    beforeEach(() => {
      savedEnv = { url: process.env.AINOTE_API_URL, key: process.env.AINOTE_API_KEY };
      delete process.env.AINOTE_API_URL;
      delete process.env.AINOTE_API_KEY;
      mock = new MockAdapter(axios);
      getCredentials.mockReset();
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      mock.restore();
      exitSpy.mockRestore();
      logSpy.mockRestore();
      for (const [k, v] of [['AINOTE_API_URL', savedEnv.url], ['AINOTE_API_KEY', savedEnv.key]]) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    });

    test('looks up credentials and posts to the same default host as login', async () => {
      getCredentials.mockResolvedValue({ mcpKey: 'mk_test' });
      mock.onPost(`${DEFAULT_API_URL}/api/mcp`).reply((config) => {
        expect(config.headers.Authorization).toBe('McpKey mk_test');
        return [200, { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'ok' }] } }];
      });

      await runCall(['list_dev_docs', '--category=memory']);

      expect(getCredentials).toHaveBeenCalledWith(DEFAULT_API_URL);
      expect(exitSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('ok');
    });
  });
});
