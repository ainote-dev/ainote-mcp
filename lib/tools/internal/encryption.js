import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAgeIdentity, getAgeRecipients } from './keychain.js';

const TMPDIR = os.tmpdir();

function ageBinary() {
  const r = spawnSync('age', ['--version'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error('age binary not found. Install: brew install age');
  }
  return 'age';
}

function withTmpFile(prefix, body, fn) {
  const tmp = path.join(TMPDIR, `${prefix}.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  try {
    return fn(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

/**
 * Encrypt plaintext for one or more recipients (age public keys).
 * Returns base64 ciphertext.
 */
export async function encryptText(plaintext, { recipients } = {}) {
  const recps = recipients || await getAgeRecipients();
  if (!recps || recps.length === 0) {
    throw new Error('No age recipients available. Run sync_init_encryption first.');
  }
  ageBinary();
  return withTmpFile('ainote-enc-in', plaintext, (inputPath) => {
    const args = ['-a']; // armored output
    for (const r of recps) {
      args.push('-r', r);
    }
    args.push(inputPath);
    const r = spawnSync('age', args, { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`age encrypt failed: ${r.stderr || 'unknown'}`);
    }
    return r.stdout;
  });
}

/**
 * Decrypt armored age ciphertext with this machine's identity from Keychain.
 */
export async function decryptText(ciphertext) {
  ageBinary();
  const identity = await getAgeIdentity();
  if (!identity) {
    throw new Error('No age identity for this machine. Run sync_init_encryption first.');
  }
  return withTmpFile('ainote-id', identity, (idPath) =>
    withTmpFile('ainote-ct', ciphertext, (ctPath) => {
      const r = spawnSync('age', ['-d', '-i', idPath, ctPath], { encoding: 'utf8' });
      if (r.status !== 0) {
        throw new Error(`age decrypt failed: ${r.stderr || 'unknown'}`);
      }
      return r.stdout;
    })
  );
}

/**
 * Generate a new age keypair. Returns { identity, recipient }.
 * Identity is the private key (AGE-SECRET-KEY-1...), recipient is the public (age1...).
 */
export function generateKeypair() {
  ageBinary();
  const r = spawnSync('age-keygen', [], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`age-keygen failed: ${r.stderr || 'unknown'}`);
  }
  const out = r.stdout;
  const recpMatch = out.match(/# public key: (age1[a-z0-9]+)/i);
  const idMatch = out.match(/(AGE-SECRET-KEY-1[A-Z0-9]+)/);
  if (!recpMatch || !idMatch) {
    throw new Error('Could not parse age-keygen output');
  }
  return { identity: out, recipient: recpMatch[1], identity_line: idMatch[1] };
}
