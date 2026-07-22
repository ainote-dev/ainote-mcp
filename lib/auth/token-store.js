/**
 * Credential persistence for the CLI.
 *
 * Primary: OS keychain via `cross-keychain` (macOS Keychain, libsecret,
 *          Windows Credential Manager). Loaded lazily via createRequire so
 *          import never fails on platforms without it.
 * Fallback: ${XDG_CONFIG_HOME:-~/.config}/ainote/credentials.json with
 *           directory mode 0o700 and file mode 0o600.
 *
 * Schema (file):
 *   {
 *     "<apiUrlHost>": {
 *       "mcp_key": "...",
 *       "access_token": "at_...",
 *       "refresh_token": "rt_...",
 *       "expires_at": 1700000000000  // ms since epoch
 *     },
 *     ...
 *   }
 *
 * Each environment (host) is namespaced so multiple ainote deployments
 * (prod / staging / localhost) can coexist on one machine.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SERVICE = '@ainote/cli';
const FIELDS = ['mcp_key', 'access_token', 'refresh_token', 'expires_at'];

let keychainModule = null;
let keychainProbed = false;

function getKeychain() {
  if (keychainProbed) return keychainModule;
  keychainProbed = true;
  try {
    keychainModule = require('cross-keychain');
  } catch (err) {
    process.stderr.write(`[ainote-mcp] cross-keychain unavailable, using file fallback: ${err.message}\n`);
    keychainModule = null;
  }
  return keychainModule;
}

function getCredentialsDir() {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.config');
  return path.join(base, 'ainote');
}

function getCredentialsFile() {
  return path.join(getCredentialsDir(), 'credentials.json');
}

function apiHost(apiUrl) {
  try {
    const parsed = new url.URL(apiUrl);
    return parsed.host || apiUrl;
  } catch {
    return apiUrl;
  }
}

function accountFor(apiUrl, field) {
  return `${apiHost(apiUrl)}:${field}`;
}

function readFileStore() {
  const file = getCredentialsFile();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`[ainote-mcp] credentials.json read failed: ${err.message}\n`);
    }
    return {};
  }
}

function writeFileStore(store) {
  const dir = getCredentialsDir();
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  // Try to tighten directory perms even if mkdir didn't get to chmod (older Node).
  try { fs.chmodSync(dir, 0o700); } catch { /* best effort */ }

  const file = getCredentialsFile();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch { /* best effort */ }
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* best effort */ }
}

async function keychainGet(apiUrl, field) {
  const kc = getKeychain();
  if (!kc || typeof kc.getPassword !== 'function') return null;
  try {
    const value = await kc.getPassword(SERVICE, accountFor(apiUrl, field));
    return value || null;
  } catch (err) {
    process.stderr.write(`[ainote-mcp] keychain read failed (${field}): ${err.message}\n`);
    return null;
  }
}

async function keychainSet(apiUrl, field, value) {
  const kc = getKeychain();
  if (!kc || typeof kc.setPassword !== 'function') return false;
  try {
    if (value === null || value === undefined || value === '') {
      if (typeof kc.deletePassword === 'function') {
        await kc.deletePassword(SERVICE, accountFor(apiUrl, field));
      }
      return true;
    }
    await kc.setPassword(SERVICE, accountFor(apiUrl, field), String(value));
    return true;
  } catch (err) {
    process.stderr.write(`[ainote-mcp] keychain write failed (${field}): ${err.message}\n`);
    return false;
  }
}

async function keychainDelete(apiUrl, field) {
  const kc = getKeychain();
  if (!kc || typeof kc.deletePassword !== 'function') return false;
  try {
    await kc.deletePassword(SERVICE, accountFor(apiUrl, field));
    return true;
  } catch (err) {
    if (err && /not found/i.test(err.message)) return true;
    return false;
  }
}

/**
 * Read credentials for the given API URL. Returns `null` if nothing is stored.
 *
 * Tries keychain first for each field; falls back to file. If both yield
 * nothing, returns null. Mixed sources (keychain mcp_key + file refresh) are
 * permitted and merged.
 *
 * @returns {Promise<null | {mcpKey?: string, accessToken?: string,
 *   refreshToken?: string, expiresAt?: number, source: 'keychain'|'file'|'mixed'}>}
 */
export async function getCredentials(apiUrl) {
  const host = apiHost(apiUrl);

  const fileStore = readFileStore();
  const fileEntry = fileStore[host] || {};

  const kc = getKeychain();
  const result = {};
  let usedKeychain = false;
  let usedFile = false;

  for (const field of FIELDS) {
    let value = null;
    if (kc) {
      value = await keychainGet(apiUrl, field);
      if (value !== null && value !== undefined) usedKeychain = true;
    }
    if (value === null || value === undefined) {
      if (fileEntry[field] !== undefined && fileEntry[field] !== null) {
        value = fileEntry[field];
        usedFile = true;
      }
    }
    if (value !== null && value !== undefined && value !== '') {
      result[field] = value;
    }
  }

  if (Object.keys(result).length === 0) return null;

  const out = {
    mcpKey: result.mcp_key,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: result.expires_at ? Number(result.expires_at) : undefined,
    source: usedKeychain && usedFile ? 'mixed' : usedKeychain ? 'keychain' : 'file'
  };
  return out;
}

/**
 * Persist credentials. Writes to keychain when available; ALWAYS also writes
 * a minimal file shadow when keychain write fails for any field, so the user
 * can still authenticate after a partial-failure scenario.
 *
 * @param {string} apiUrl
 * @param {{mcpKey?: string, accessToken?: string, refreshToken?: string, expiresAt?: number|string}} creds
 * @returns {Promise<{storage: 'keychain'|'file'|'mixed', file?: string}>}
 */
export async function setCredentials(apiUrl, creds) {
  const host = apiHost(apiUrl);
  const mapping = {
    mcp_key: creds.mcpKey,
    access_token: creds.accessToken,
    refresh_token: creds.refreshToken,
    expires_at: creds.expiresAt === undefined ? undefined : String(creds.expiresAt)
  };

  let keychainOk = true;
  let anyKeychain = false;

  for (const [field, value] of Object.entries(mapping)) {
    if (value === undefined) continue;
    const ok = await keychainSet(apiUrl, field, value);
    if (ok) anyKeychain = true;
    else keychainOk = false;
  }

  let fileWritten = false;
  if (!anyKeychain || !keychainOk) {
    // Write or merge file store so credentials survive even if some keychain
    // writes failed.
    const store = readFileStore();
    const entry = { ...(store[host] || {}) };
    for (const [field, value] of Object.entries(mapping)) {
      if (value === undefined) continue;
      if (value === null || value === '') delete entry[field];
      else entry[field] = field === 'expires_at' ? Number(value) : value;
    }
    store[host] = entry;
    writeFileStore(store);
    fileWritten = true;
  }

  let storage;
  if (anyKeychain && !fileWritten) storage = 'keychain';
  else if (!anyKeychain && fileWritten) storage = 'file';
  else storage = 'mixed';

  return {
    storage,
    file: fileWritten ? getCredentialsFile() : undefined
  };
}

/**
 * Remove credentials for the given API URL from both keychain and file.
 * Best-effort: errors are swallowed and the caller can assume cleared state.
 */
export async function clearCredentials(apiUrl) {
  const host = apiHost(apiUrl);

  for (const field of FIELDS) {
    await keychainDelete(apiUrl, field);
  }

  try {
    const store = readFileStore();
    if (store[host]) {
      delete store[host];
      if (Object.keys(store).length === 0) {
        try { fs.unlinkSync(getCredentialsFile()); } catch { /* ignore */ }
      } else {
        writeFileStore(store);
      }
    }
  } catch (err) {
    process.stderr.write(`[ainote-mcp] file credentials clear failed: ${err.message}\n`);
  }
}

/**
 * Internal helper for diagnostics. Not part of public API.
 */
export function _credentialsLocations() {
  return {
    keychainService: SERVICE,
    file: getCredentialsFile()
  };
}
