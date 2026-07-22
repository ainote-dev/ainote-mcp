/**
 * Cross-platform secret storage for ainote sync (async).
 * - Primary: cross-keychain (macOS Keychain / libsecret / Windows Credential Manager)
 * - Fallback: ~/.config/ainote/age-identity.txt (0600)
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const SERVICE = 'ainote-sync';
const ACCOUNT_IDENTITY = 'age-identity';
const ACCOUNT_RECIPIENTS = 'age-recipients';

const FALLBACK_DIR = path.join(os.homedir(), '.config', 'ainote');
const FALLBACK_IDENTITY = path.join(FALLBACK_DIR, 'age-identity.txt');
const FALLBACK_RECIPIENTS = path.join(FALLBACK_DIR, 'age-recipients.json');

let ck = null;
function getKeychain() {
  if (ck !== null) return ck;
  try {
    ck = require('cross-keychain');
  } catch {
    ck = false;
  }
  return ck;
}

function fsRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function fsWrite(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, value, { mode: 0o600 });
}

async function readSecret(account, fallbackPath) {
  const kc = getKeychain();
  if (kc && typeof kc.getPassword === 'function') {
    try {
      const v = await kc.getPassword(SERVICE, account);
      if (v) return v;
    } catch {}
  }
  return fsRead(fallbackPath);
}

async function writeSecret(account, value, fallbackPath) {
  const kc = getKeychain();
  if (kc && typeof kc.setPassword === 'function') {
    try {
      await kc.setPassword(SERVICE, account, value);
      return 'keychain';
    } catch {}
  }
  fsWrite(fallbackPath, value);
  return `file:${fallbackPath}`;
}

export async function getAgeIdentity() {
  return readSecret(ACCOUNT_IDENTITY, FALLBACK_IDENTITY);
}

export async function setAgeIdentity(identityText) {
  return writeSecret(ACCOUNT_IDENTITY, identityText, FALLBACK_IDENTITY);
}

export async function getAgeRecipients() {
  const raw = await readSecret(ACCOUNT_RECIPIENTS, FALLBACK_RECIPIENTS);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function setAgeRecipients(list) {
  return writeSecret(ACCOUNT_RECIPIENTS, JSON.stringify(list), FALLBACK_RECIPIENTS);
}

export async function addRecipient(recipient) {
  const current = await getAgeRecipients();
  if (!current.includes(recipient)) {
    current.push(recipient);
    await setAgeRecipients(current);
  }
  return current;
}

export function storageBackend() {
  return getKeychain() ? 'cross-keychain' : 'file-fallback';
}
