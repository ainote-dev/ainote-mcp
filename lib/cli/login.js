/**
 * `ainote-mcp login` — interactive device-authorization grant flow.
 *
 * UX:
 *   1. Request device code from server.
 *   2. Display the user_code in an ASCII box.
 *   3. Print verification URL and try to open it in a browser (unless --no-browser).
 *   4. Spin while polling for token.
 *   5. On success, persist to keychain/file.
 *
 * Flags:
 *   --scope=mcp,read,write   Comma-separated scope list (default: mcp,read,write).
 *   --no-browser             Don't auto-open the verification URL.
 *   --client-name=<name>     Override client_name shown on the consent screen.
 *
 * SIGINT cancels the in-flight authorization (best effort) and exits 1.
 */
import process from 'node:process';
import os from 'node:os';
import {
  requestDeviceCode,
  pollForToken,
  cancel,
  DeviceAccessDeniedError,
  DeviceExpiredError,
  DevicePkceError,
  DeviceNetworkError
} from '../auth/device-flow.js';
import { setCredentials, _credentialsLocations } from '../auth/token-store.js';

const DEFAULT_API_URL = 'https://ainote-5muq.onrender.com';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function parseArgs(argv) {
  const args = {
    scope: 'mcp,read,write',
    noBrowser: false,
    clientName: `ainote-mcp CLI (${os.hostname()})`
  };
  for (const arg of argv) {
    if (arg === '--no-browser') {
      args.noBrowser = true;
    } else if (arg.startsWith('--scope=')) {
      args.scope = arg.slice('--scope='.length);
    } else if (arg === '--scope') {
      // next-token form is not supported in this minimal parser
      args.scope = args.scope;
    } else if (arg.startsWith('--client-name=')) {
      args.clientName = arg.slice('--client-name='.length);
    }
  }
  return args;
}

function drawUserCodeBox(userCode) {
  const padded = `   ${userCode}   `;
  const width = padded.length;
  const top = `┌${'─'.repeat(width)}┐`;
  const mid = `│${padded}│`;
  const bot = `└${'─'.repeat(width)}┘`;
  return `${top}\n${mid}\n${bot}`;
}

class Spinner {
  constructor() {
    this.frame = 0;
    this.suffix = '';
    this.timer = null;
    this.active = false;
  }

  start(initialSuffix = '') {
    if (this.active) return;
    this.active = true;
    this.suffix = initialSuffix;
    this.timer = setInterval(() => this._render(), 100);
    this._render();
  }

  update(suffix) {
    this.suffix = suffix;
  }

  _render() {
    const frame = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
    this.frame += 1;
    if (process.stderr.isTTY) {
      process.stderr.write(`\r${frame} ${this.suffix}\x1b[K`);
    }
  }

  stop(finalLine) {
    if (!this.active) return;
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (process.stderr.isTTY) {
      process.stderr.write('\r\x1b[K');
    }
    if (finalLine) {
      process.stderr.write(`${finalLine}\n`);
    }
  }
}

async function tryOpenBrowser(uri) {
  try {
    const mod = await import('open');
    const open = mod.default || mod;
    await open(uri);
    return true;
  } catch (err) {
    return false;
  }
}

export async function run(argv = process.argv.slice(3)) {
  const apiUrl = (process.env.AINOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  const args = parseArgs(argv);
  const scopes = args.scope.split(',').map((s) => s.trim()).filter(Boolean);

  console.log('');
  console.log(`  AI Note MCP — Login`);
  console.log(`  API: ${apiUrl}`);
  console.log('');

  let device;
  try {
    device = await requestDeviceCode({
      apiUrl,
      clientName: args.clientName,
      scopes
    });
  } catch (err) {
    if (err instanceof DeviceNetworkError) {
      console.error(`  Network error: ${err.message}`);
    } else {
      console.error(`  Failed to start login: ${err.message}`);
    }
    process.exit(1);
    return;
  }

  console.log(`  Visit the URL below and enter the code:`);
  console.log('');
  console.log(drawUserCodeBox(device.user_code));
  console.log('');
  console.log(`  ${device.verification_uri}`);
  if (device.verification_uri_complete && device.verification_uri_complete !== device.verification_uri) {
    console.log(`  (direct link: ${device.verification_uri_complete})`);
  }
  console.log('');

  if (!args.noBrowser) {
    const target = device.verification_uri_complete || device.verification_uri;
    const opened = await tryOpenBrowser(target);
    if (opened) {
      console.log('  Opening your browser…');
    } else {
      console.log('  (Could not open browser automatically — please open the URL above.)');
    }
    console.log('');
  }

  const spinner = new Spinner();
  spinner.start(`Waiting for authorization… (0s elapsed, next poll in ${device.interval}s)`);

  let cancelled = false;
  const sigintHandler = async () => {
    if (cancelled) return;
    cancelled = true;
    spinner.stop('Cancelled.');
    await cancel({ apiUrl, deviceCode: device.device_code });
    process.exit(1);
  };
  process.once('SIGINT', sigintHandler);

  try {
    const tokens = await pollForToken({
      apiUrl,
      deviceCode: device.device_code,
      codeVerifier: device.code_verifier,
      interval: device.interval,
      expiresIn: device.expires_in,
      onTick: ({ elapsed, interval }) => {
        spinner.update(`Waiting for authorization… (${elapsed}s elapsed, next poll in ${interval}s)`);
      }
    });

    spinner.stop();
    process.removeListener('SIGINT', sigintHandler);

    const expiresAt = tokens.expires_in
      ? Date.now() + Number(tokens.expires_in) * 1000
      : undefined;

    const persisted = await setCredentials(apiUrl, {
      mcpKey: tokens.mcp_key,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    });

    const email = tokens.user?.email;
    const locationDesc = persisted.storage === 'keychain'
      ? 'OS keychain'
      : persisted.storage === 'mixed'
        ? `OS keychain + ${persisted.file}`
        : persisted.file || _credentialsLocations().file;

    console.log('');
    if (email) {
      console.log(`  ✓ Logged in as ${email}.`);
    } else {
      console.log(`  ✓ Logged in.`);
    }
    console.log(`  Credentials saved to ${locationDesc}.`);
    console.log('');
  } catch (err) {
    spinner.stop();
    process.removeListener('SIGINT', sigintHandler);

    if (err instanceof DeviceAccessDeniedError) {
      console.error('  Access denied. The authorization request was rejected.');
    } else if (err instanceof DeviceExpiredError) {
      console.error('  Code expired. Please run `ainote-mcp login` again.');
    } else if (err instanceof DevicePkceError) {
      console.error('  Authentication failed (PKCE mismatch). Please retry.');
    } else if (err instanceof DeviceNetworkError) {
      console.error(`  Network error: ${err.message}`);
    } else {
      console.error(`  Login failed: ${err.message}`);
    }
    process.exit(1);
  }
}
