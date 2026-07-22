import fs from 'fs';
import path from 'path';
import os from 'os';
import { canonicalizePath } from './path-mapper.js';

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.js', '.ts', '.sh', '.py', '.rb', '.css', '.html'
]);

function isTextFile(p) {
  return TEXT_EXTENSIONS.has(path.extname(p).toLowerCase());
}

function walkDir(root, maxFiles = 500) {
  const out = [];
  if (!fs.existsSync(root)) return out;

  function visit(dir) {
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        visit(full);
      } else if (e.isFile() && isTextFile(e.name)) {
        out.push(full);
      }
      if (out.length >= maxFiles) return;
    }
  }
  visit(root);
  return out;
}

function detectContentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.md') return 'markdown';
  return 'text';
}

/**
 * Scan a Claude subdirectory (skills/agents/commands/hooks) and return file
 * descriptors ready for create_dev_doc calls.
 *
 * Returns: [{ title, content, content_type, local_path, relative_path }]
 *   - title:        unique per-file (e.g., "skills/ui-ux-pro-max/SKILL.md")
 *   - local_path:   canonicalized (~/...) so pull works cross-platform
 *   - relative_path: path relative to ~/.claude/<subdir>/
 */
export function scanClaudeSubdir(subdir, { maxFiles = 500 } = {}) {
  const root = path.join(CLAUDE_DIR, subdir);
  const files = walkDir(root, maxFiles);
  const results = [];
  for (const abs of files) {
    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const relativeFromClaude = path.relative(CLAUDE_DIR, abs);
    const relativeFromSubdir = path.relative(root, abs);
    results.push({
      title: relativeFromClaude.replace(/\\/g, '/'),
      content,
      content_type: detectContentType(abs),
      local_path: canonicalizePath(abs),
      relative_path: relativeFromSubdir.replace(/\\/g, '/'),
      size: content.length
    });
  }
  return results;
}

/**
 * Read mcpServers section from ~/.claude.json.
 * Returns the object (possibly empty) and the canonicalized source path.
 */
export function readMcpServers() {
  const claudeJson = path.join(HOME, '.claude.json');
  if (!fs.existsSync(claudeJson)) {
    return { servers: {}, source: canonicalizePath(claudeJson), exists: false };
  }
  try {
    const raw = fs.readFileSync(claudeJson, 'utf8');
    const json = JSON.parse(raw);
    return {
      servers: json.mcpServers || {},
      source: canonicalizePath(claudeJson),
      exists: true
    };
  } catch (e) {
    throw new Error(`Failed to parse ~/.claude.json: ${e.message}`);
  }
}

/**
 * Sidecar pattern: write mcpServers snapshot to ~/.claude/mcp-servers.d/<name>.json
 * Never touches ~/.claude.json directly (avoids live-write corruption).
 */
export function writeMcpServersSidecar(servers, { name = 'from-ainote' } = {}) {
  const sidecarDir = path.join(CLAUDE_DIR, 'mcp-servers.d');
  fs.mkdirSync(sidecarDir, { recursive: true });
  const target = path.join(sidecarDir, `${name}.json`);
  const tmp = `${target}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify({ mcpServers: servers }, null, 2));
  fs.renameSync(tmp, target);
  return canonicalizePath(target);
}

/**
 * Preview what would be synced. Read-only, fast.
 */
export function discoverSyncTargets() {
  const result = {
    claude_dir: canonicalizePath(CLAUDE_DIR),
    targets: {}
  };
  for (const sub of ['skills', 'agents', 'commands', 'hooks']) {
    const files = scanClaudeSubdir(sub);
    result.targets[sub] = {
      file_count: files.length,
      total_bytes: files.reduce((a, b) => a + b.size, 0),
      samples: files.slice(0, 3).map(f => f.title)
    };
  }
  try {
    const mcp = readMcpServers();
    result.targets.mcp_servers = {
      file_count: Object.keys(mcp.servers).length,
      total_bytes: JSON.stringify(mcp.servers).length,
      samples: Object.keys(mcp.servers).slice(0, 5)
    };
  } catch (e) {
    result.targets.mcp_servers = { error: e.message };
  }
  return result;
}
