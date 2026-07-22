import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Cross-platform path mapper for ainote multi-device sync.
 *
 * Problem:
 *   local_path is stored from the ORIGINAL machine (e.g. macOS).
 *   When pulled on a DIFFERENT platform (e.g. WSL), paths don't match.
 *
 * Platform path patterns:
 *   macOS:          HOME=/Users/<user>        project key: -Users-<user>
 *   WSL:            HOME=/home/<user>          project key: -mnt-c-Users-<winuser>  (CWD=/mnt/c/Users/<winuser>)
 *   Linux:          HOME=/home/<user>          project key: -home-<user>
 *   Windows Native: HOME=C:\Users\<user>      project key: -C-Users-<user> or -Users-<user>
 *
 * Claude Code encodes CWD into project key by replacing / with -.
 * The "global" memory lives under the home/CWD project key.
 */

// ── Platform detection ──

function detectPlatform() {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';

  // Linux — check for WSL
  try {
    const ver = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    if (ver.includes('microsoft') || ver.includes('wsl')) return 'wsl';
  } catch { /* ignore */ }

  return 'linux';
}

const CURRENT_PLATFORM = detectPlatform();
const HOME = os.homedir();

// ── Windows home detection for WSL ──

function detectWindowsHome() {
  if (CURRENT_PLATFORM !== 'wsl') return null;

  // Method 1: WSLHOME env var (user-set)
  if (process.env.WSLHOME) return process.env.WSLHOME;

  // Method 2: cmd.exe to get USERPROFILE
  try {
    const profile = execSync('cmd.exe /C "echo %USERPROFILE%"', { encoding: 'utf8', timeout: 3000 })
      .trim().replace(/\r?\n/g, '');
    if (profile && !profile.includes('%')) {
      // Convert C:\Users\Owner → /mnt/c/Users/Owner
      return profile.replace(/^([A-Z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
    }
  } catch { /* cmd.exe might not be available */ }

  // Method 3: scan /mnt/c/Users/
  try {
    const usersDir = '/mnt/c/Users';
    const skip = new Set(['Public', 'Default', 'Default User', 'All Users', 'desktop.ini']);
    const entries = fs.readdirSync(usersDir).filter(e => {
      if (skip.has(e)) return false;
      try { return fs.statSync(path.join(usersDir, e)).isDirectory(); } catch { return false; }
    });
    if (entries.length === 1) return path.join(usersDir, entries[0]);
    // Multiple users — try matching linux username
    const linuxUser = os.userInfo().username;
    const match = entries.find(e => e.toLowerCase() === linuxUser.toLowerCase());
    if (match) return path.join(usersDir, match);
    // Return first non-admin looking one
    if (entries.length > 0) return path.join(usersDir, entries[0]);
  } catch { /* not WSL or no /mnt/c */ }

  return null;
}

// Cache Windows home (lazy)
let _winHome;
let _winHomeResolved = false;

function getWindowsHome() {
  if (!_winHomeResolved) {
    _winHome = detectWindowsHome();
    _winHomeResolved = true;
  }
  return _winHome;
}

// ── Claude project key ──

/**
 * Get the current platform's "home" project key.
 * This is what Claude Code uses for the global memory directory.
 */
function currentHomeProjectKey() {
  if (CURRENT_PLATFORM === 'wsl') {
    const winHome = getWindowsHome();
    if (winHome) return winHome.replace(/\//g, '-');
  }
  // macOS: -Users-seunghan, Linux: -home-seunghan
  return HOME.replace(/\//g, '-');
}

// ── Home-dir project key detection ──
// These regex patterns match the "home directory" project keys from each platform.

const HOME_KEY_PATTERNS = [
  /^-Users-[^-]+$/,               // macOS: -Users-seunghan
  /^-mnt-[a-z]-Users-[^-]+$/,     // WSL:   -mnt-c-Users-Owner
  /^-home-[^-]+$/,                // Linux: -home-seunghan
  /^-[A-Z]-Users-[^-]+$/,         // Windows Native: -C-Users-Owner
];

// Project key patterns (home key + project name suffix)
const PROJECT_KEY_EXTRACTORS = [
  { pattern: /^-Users-[^-]+-(.+)$/,           platform: 'macos' },    // -Users-seunghan-launchcrew
  { pattern: /^-mnt-[a-z]-Users-[^-]+-(.+)$/, platform: 'wsl' },      // -mnt-c-Users-Owner-launchcrew
  { pattern: /^-home-[^-]+-(.+)$/,            platform: 'linux' },    // -home-seunghan-launchcrew
  { pattern: /^-[A-Z]-Users-[^-]+-(.+)$/,     platform: 'windows' },  // -C-Users-Owner-launchcrew
];

function isHomeProjectKey(key) {
  return HOME_KEY_PATTERNS.some(p => p.test(key));
}

function extractProjectName(key) {
  for (const { pattern } of PROJECT_KEY_EXTRACTORS) {
    const m = key.match(pattern);
    if (m) return m[1];
  }
  return null;
}

// ── Home directory prefix patterns ──

const HOME_PREFIX_PATTERNS = [
  /^\/Users\/[^/]+/,              // macOS
  /^\/mnt\/[a-z]\/Users\/[^/]+/,  // WSL (Windows files)
  /^\/home\/[^/]+/,               // Linux / WSL native
  /^[A-Z]:\\Users\\[^\\]+/,       // Windows Native
];

// ── Main path mapping ──

/**
 * Transform a stored local_path to work on the current platform.
 *
 * Examples (stored on macOS, pulled on WSL):
 *   ~/.claude/projects/-Users-seunghan/memory/MEMORY.md
 *   → ~/.claude/projects/-mnt-c-Users-Owner/memory/MEMORY.md
 *   → /home/seunghan/.claude/projects/-mnt-c-Users-Owner/memory/MEMORY.md
 *
 *   /Users/seunghan/launchcrew/CLAUDE.md
 *   → /home/seunghan/launchcrew/CLAUDE.md
 */
export function mapPathForCurrentPlatform(storedPath) {
  if (!storedPath) return storedPath;

  let p = storedPath;

  // Step 1: Expand ~ to current HOME
  p = p.replace(/^~/, HOME);

  // Step 2: Replace any foreign home directory prefix with current HOME
  for (const pattern of HOME_PREFIX_PATTERNS) {
    if (pattern.test(p)) {
      p = p.replace(pattern, HOME);
      break;
    }
  }

  // Step 3: Map Claude project keys
  // Pattern: .../.claude/projects/<KEY>/...
  const claudeProjectRegex = /(\/\.claude\/projects\/)([-\w]+)(\/)/;
  const match = p.match(claudeProjectRegex);
  if (match) {
    const storedKey = match[2];
    const myHomeKey = currentHomeProjectKey();

    if (isHomeProjectKey(storedKey)) {
      // Home project key → replace with current platform's home key
      p = p.replace(claudeProjectRegex, `$1${myHomeKey}$3`);
    } else {
      // Project-specific key → extract project name + append to current home key
      const projectName = extractProjectName(storedKey);
      if (projectName) {
        const newKey = `${myHomeKey}-${projectName}`;
        p = p.replace(claudeProjectRegex, `$1${newKey}$3`);
      }
    }
  }

  return p;
}

/**
 * Normalize a local_path to canonical form before storing.
 * Replaces absolute home path with ~ for portability.
 */
export function canonicalizePath(localPath) {
  if (!localPath) return localPath;
  return localPath.replace(new RegExp(`^${escapeRegex(HOME)}`), '~');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get current platform info (for diagnostics / tool output).
 */
export function getPlatformInfo() {
  return {
    platform: CURRENT_PLATFORM,
    home: HOME,
    homeProjectKey: currentHomeProjectKey(),
    windowsHome: CURRENT_PLATFORM === 'wsl' ? getWindowsHome() : undefined,
  };
}
