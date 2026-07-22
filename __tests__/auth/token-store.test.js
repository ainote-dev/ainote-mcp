/**
 * Phase 6 — token-store.js credential-persistence tests.
 *
 * We force the keychain path to fail by installing a fail-stub keyring via
 * `cross-keychain.setKeyring`. That funnels writes/reads to the file fallback,
 * which is what we want to exercise.
 *
 * Each test gets an isolated XDG_CONFIG_HOME (so we never touch the dev
 * machine's real ~/.config/ainote/credentials.json).
 */
import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

import {
  getCredentials,
  setCredentials,
  clearCredentials,
  _credentialsLocations
} from '../../lib/auth/token-store.js';

const API_URL_A = 'https://prod.api.ainote.dev';
const API_URL_B = 'https://staging.api.ainote.dev';

/** Install a keyring that throws on every operation. */
function installFailKeyring() {
  const cc = require('cross-keychain');
  const failKeyring = {
    name: 'fail-test',
    priority: 100,
    isViable: async () => true,
    getPassword: async () => null,                 // return null → token-store falls through to file
    setPassword: async () => { throw new Error('keychain disabled for test'); },
    deletePassword: async () => { throw new Error('keychain disabled for test'); }
  };
  cc.setKeyring(failKeyring);
}

describe('token-store.js file fallback', () => {
  let tmpDir;
  let prevXdg;

  beforeAll(() => {
    installFailKeyring();
  });

  beforeEach(() => {
    prevXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ainote-cli-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  it('setCredentials writes credentials.json with mode 0o600 and the host-namespaced schema', async () => {
    const expiresAt = Date.now() + 60_000;
    const result = await setCredentials(API_URL_A, {
      mcpKey: 'mk_test',
      accessToken: 'at_test',
      refreshToken: 'rt_test',
      expiresAt
    });

    expect(result.storage === 'file' || result.storage === 'mixed').toBe(true);

    const locs = _credentialsLocations();
    expect(locs.file).toContain(tmpDir);
    expect(fs.existsSync(locs.file)).toBe(true);

    const stat = fs.statSync(locs.file);
    // POSIX mode: last 9 bits = perms. 0o600 = owner rw only.
    expect(stat.mode & 0o777).toBe(0o600);

    const stored = JSON.parse(fs.readFileSync(locs.file, 'utf8'));
    // host-namespaced
    expect(stored['prod.api.ainote.dev']).toBeDefined();
    const entry = stored['prod.api.ainote.dev'];
    expect(entry.mcp_key).toBe('mk_test');
    expect(entry.access_token).toBe('at_test');
    expect(entry.refresh_token).toBe('rt_test');
    expect(entry.expires_at).toBe(expiresAt);
  });

  it('getCredentials round-trips the values stored by setCredentials', async () => {
    const expiresAt = Date.now() + 120_000;
    await setCredentials(API_URL_A, {
      mcpKey: 'mk_rt',
      accessToken: 'at_rt',
      refreshToken: 'rt_rt',
      expiresAt
    });

    const creds = await getCredentials(API_URL_A);
    expect(creds).not.toBeNull();
    expect(creds.mcpKey).toBe('mk_rt');
    expect(creds.accessToken).toBe('at_rt');
    expect(creds.refreshToken).toBe('rt_rt');
    expect(creds.expiresAt).toBe(expiresAt);
  });

  it('namespaces credentials by host: two API URLs coexist in one file', async () => {
    await setCredentials(API_URL_A, { mcpKey: 'mk_A' });
    await setCredentials(API_URL_B, { mcpKey: 'mk_B' });

    const locs = _credentialsLocations();
    const stored = JSON.parse(fs.readFileSync(locs.file, 'utf8'));
    expect(Object.keys(stored).sort()).toEqual([
      'prod.api.ainote.dev', 'staging.api.ainote.dev'
    ]);
    expect(stored['prod.api.ainote.dev'].mcp_key).toBe('mk_A');
    expect(stored['staging.api.ainote.dev'].mcp_key).toBe('mk_B');

    const a = await getCredentials(API_URL_A);
    const b = await getCredentials(API_URL_B);
    expect(a.mcpKey).toBe('mk_A');
    expect(b.mcpKey).toBe('mk_B');
  });

  it('clearCredentials removes only the target host, not its siblings', async () => {
    await setCredentials(API_URL_A, { mcpKey: 'mk_A' });
    await setCredentials(API_URL_B, { mcpKey: 'mk_B' });

    await clearCredentials(API_URL_A);

    const locs = _credentialsLocations();
    // After clearing one of two, the file should still exist with only B
    expect(fs.existsSync(locs.file)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(locs.file, 'utf8'));
    expect(stored['prod.api.ainote.dev']).toBeUndefined();
    expect(stored['staging.api.ainote.dev']).toBeDefined();
    expect(stored['staging.api.ainote.dev'].mcp_key).toBe('mk_B');

    const a = await getCredentials(API_URL_A);
    expect(a).toBeNull();
    const b = await getCredentials(API_URL_B);
    expect(b.mcpKey).toBe('mk_B');
  });

  it('honours XDG_CONFIG_HOME for the credentials directory', async () => {
    await setCredentials(API_URL_A, { mcpKey: 'mk_xdg' });
    const locs = _credentialsLocations();
    expect(locs.file.startsWith(path.join(tmpDir, 'ainote'))).toBe(true);
  });
});
