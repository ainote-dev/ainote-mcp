import { toSuccessContent } from './internal/formatters.js';
import { mapPathForCurrentPlatform, canonicalizePath, getPlatformInfo } from './internal/path-mapper.js';
import { scanClaudeSubdir, readMcpServers, writeMcpServersSidecar, discoverSyncTargets } from './internal/claude-scanner.js';
import { encryptText, decryptText, generateKeypair } from './internal/encryption.js';
import { getAgeIdentity, setAgeIdentity, getAgeRecipients, addRecipient, storageBackend } from './internal/keychain.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function listDevDocsDefinition() {
  return {
    name: 'list_dev_docs',
    description: `List your synced dev documents stored in AI Note cloud.

Shows all documents under dev/ category including memory files, AI configs, and project docs.
Use this to see what's synced and which files have local_path set for multi-device sync.

Categories: memory, claude, cursor, windsurf, env, docs, or custom subcategories.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Subcategory filter (claude, cursor, windsurf, copilot, docs, etc.)'
        },
        search: {
          type: 'string',
          description: 'Search keyword in document title'
        },
        content_type: {
          type: 'string',
          enum: ['markdown', 'json', 'yaml', 'text'],
          description: 'Filter by content type'
        }
      }
    }
  };
}

function getDevDocDefinition() {
  return {
    name: 'get_dev_doc',
    description: 'Get a single dev document by title or id. Returns full content.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title (e.g., project-a-memory.md)' },
        id: { type: 'string', description: 'Document UUID' },
        category: { type: 'string', description: 'Subcategory (claude, cursor, etc.) to disambiguate' },
        include_versions: { type: 'boolean', description: 'Include version history (default: false)' }
      }
    }
  };
}

function createDevDocDefinition() {
  return {
    name: 'create_dev_doc',
    description: `Save a file to AI Note cloud for multi-device sync.

PRIMARY USE CASES:
- Memory files: ~/.claude/projects/.../memory/MEMORY.md
- AI configs: CLAUDE.md, .cursorrules, .windsurfrules (not in git)
- Project docs: architecture notes, planning docs

Set local_path to enable pull_dev_docs auto-sync on other devices.
Categories: memory | claude | cursor | env | docs`,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title (e.g., project-a-claude.md)' },
        content: { type: 'string', description: 'Document content (markdown, json, yaml)' },
        category: {
          type: 'string',
          description: 'Subcategory (claude, cursor, windsurf, copilot, docs). Default: docs'
        },
        content_type: {
          type: 'string',
          enum: ['markdown', 'json', 'yaml', 'text'],
          description: 'Content type. Auto-detected from title extension if omitted.'
        },
        local_path: {
          type: 'string',
          description: 'Absolute local file path for multi-device sync (e.g., ~/.claude/projects/.../MEMORY.md)'
        }
      },
      required: ['title', 'content']
    }
  };
}

function updateDevDocDefinition() {
  return {
    name: 'update_dev_doc',
    description: 'Update a dev document. Supports replace, append, or prepend modes.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        id: { type: 'string', description: 'Document UUID' },
        category: { type: 'string', description: 'Subcategory to disambiguate' },
        content: { type: 'string', description: 'New content' },
        mode: {
          type: 'string',
          enum: ['replace', 'append', 'prepend'],
          description: 'Update mode (default: replace)'
        },
        local_path: {
          type: 'string',
          description: 'Update the local file path for multi-device sync'
        }
      },
      required: ['content']
    }
  };
}

function deleteDevDocDefinition() {
  return {
    name: 'delete_dev_doc',
    description: 'Delete a dev document (soft delete).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        id: { type: 'string', description: 'Document UUID' },
        category: { type: 'string', description: 'Subcategory to disambiguate' }
      }
    }
  };
}

function pullDevDocsDefinition() {
  return {
    name: 'pull_dev_docs',
    description: `Restore all synced files to THIS device. Writes files to their local paths on disk.

USE THIS WHEN:
- Setting up a new machine (desktop, laptop, WSL)
- Switching between macOS / Windows / Linux
- Want to sync latest versions of memory/config files from cloud

WHAT HAPPENS:
1. Fetches all dev docs with local_path set
2. Auto-detects platform (macOS/WSL/Linux/Windows) and maps paths accordingly
3. Creates missing parent directories
4. Writes content to each mapped local_path on this machine

CROSS-PLATFORM PATH MAPPING (automatic):
- macOS ~/... ↔ WSL ~/... ↔ Linux ~/...
- Claude project keys mapped per platform (e.g., -Users-seunghan ↔ -mnt-c-Users-Owner)

Run once after installing ainote MCP on a new device to restore everything.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Subcategory filter. Omit to pull all docs with local_path.'
        }
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────
// Claude environment sync tools (Phase A: server-untouched wrappers)
// ─────────────────────────────────────────────────────────────

function discoverClaudeSyncTargetsDefinition() {
  return {
    name: 'discover_claude_sync_targets',
    description: `Preview what would be synced from ~/.claude/ to ainote cloud.

Read-only. Shows file counts, sizes, and sample names for:
- skills/      (directory bundles like ui-ux-pro-max/)
- agents/      (single .md files)
- commands/    (slash command definitions)
- hooks/       (event handler scripts)
- mcp_servers  (mcpServers section of ~/.claude.json)

Run this BEFORE push_claude_* tools to see scope.`,
    inputSchema: { type: 'object', properties: {} }
  };
}

function pushClaudeFilesDefinition(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        dry_run: {
          type: 'boolean',
          description: 'Preview without uploading. Default: false'
        },
        max_files: {
          type: 'number',
          description: `Max files to push (safety cap). Default: 500`
        }
      }
    }
  };
}

function pushClaudeMcpServersDefinition() {
  return {
    name: 'push_claude_mcp_servers',
    description: `Snapshot ~/.claude.json mcpServers section to ainote cloud (mcp category).

Stores as a single JSON dev_doc titled "mcp-servers-snapshot.json".
Includes API keys/env vars currently — Phase B will add encryption.

⚠️ Until encryption lands, only run when comfortable storing keys server-side
(server is private to your account, but keys are not zero-knowledge yet).`,
    inputSchema: {
      type: 'object',
      properties: {
        dry_run: { type: 'boolean', description: 'Preview only. Default: false' }
      }
    }
  };
}

function pullClaudeMcpServersDefinition() {
  return {
    name: 'pull_claude_mcp_servers',
    description: `Restore mcpServers snapshot from ainote cloud to a SIDECAR file.

Writes to ~/.claude/mcp-servers.d/from-ainote.json (NOT ~/.claude.json directly).
This avoids corrupting the live-written ~/.claude.json while Claude is running.

After pull, to actually activate the servers you must either:
  (a) merge manually: jq -s '.[0] * .[1]' ~/.claude.json ~/.claude/mcp-servers.d/from-ainote.json > new.json
  (b) close Claude, then run a future merge tool (Phase B)

Sidecar approach = safe always, manual merge step required.`,
    inputSchema: {
      type: 'object',
      properties: {
        sidecar_name: {
          type: 'string',
          description: 'Sidecar filename stem. Default: from-ainote'
        }
      }
    }
  };
}

async function pushClaudeFilesHandler(subdir, args, { apiClient }) {
  const dryRun = args.dry_run === true;
  const maxFiles = typeof args.max_files === 'number' ? args.max_files : 500;
  const files = scanClaudeSubdir(subdir, { maxFiles });

  if (files.length === 0) {
    return [{ type: 'text', text: `No text files found under ~/.claude/${subdir}/` }];
  }

  if (dryRun) {
    const list = files.slice(0, 20).map(f => `  ${f.title} (${f.size}b)`).join('\n');
    const more = files.length > 20 ? `\n  ... and ${files.length - 20} more` : '';
    return [{ type: 'text', text: `Would push ${files.length} files from ~/.claude/${subdir}/:\n${list}${more}` }];
  }

  const pushed = [];
  const errors = [];
  for (const f of files) {
    try {
      const created = await apiClient.callTool('create_dev_doc', {
        title: f.title,
        content: f.content,
        category: subdir,
        content_type: f.content_type,
        local_path: f.local_path
      });
      // Server may return error inside content — surface it
      const isErr = Array.isArray(created?.content) && created.content.some(c => c.type === 'text' && /error/i.test(c.text || ''));
      if (isErr) {
        errors.push(`⚠️ ${f.title}: ${created.content.map(c => c.text).join(' ').slice(0, 200)}`);
      } else {
        pushed.push(`✅ ${f.title}`);
      }
    } catch (e) {
      errors.push(`❌ ${f.title}: ${e.message}`);
    }
  }

  const summary = [
    `Pushed ${pushed.length}/${files.length} files from ~/.claude/${subdir}/ → ainote (category: ${subdir})`,
    pushed.length ? `\n${pushed.slice(0, 30).join('\n')}` : null,
    pushed.length > 30 ? `... and ${pushed.length - 30} more` : null,
    errors.length ? `\nErrors:\n${errors.join('\n')}` : null
  ].filter(Boolean).join('\n');

  return [{ type: 'text', text: summary }];
}

function listDevCategoriesDefinition() {
  return {
    name: 'list_dev_categories',
    description: 'List all subcategories under dev/. Shows document count per category.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  };
}

export function getDevDocTools() {
  return [
    {
      definition: listDevDocsDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('list_dev_docs', args);
        return result;
      }
    },
    {
      definition: getDevDocDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('get_dev_doc', args);
        return result;
      }
    },
    {
      definition: createDevDocDefinition(),
      handler: async (args, { apiClient }) => {
        // Canonicalize local_path (replace $HOME with ~) for portability
        if (args.local_path) {
          args.local_path = canonicalizePath(args.local_path);
        }
        const result = await apiClient.callTool('create_dev_doc', args);
        return result;
      }
    },
    {
      definition: updateDevDocDefinition(),
      handler: async (args, { apiClient }) => {
        if (args.local_path) {
          args.local_path = canonicalizePath(args.local_path);
        }
        const result = await apiClient.callTool('update_dev_doc', args);
        return result;
      }
    },
    {
      definition: deleteDevDocDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('delete_dev_doc', args);
        return result;
      }
    },
    {
      definition: pullDevDocsDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('pull_dev_docs', args);

        // Extract docs from resource data and write to local paths
        let written = [];
        let skipped = [];
        let errors = [];

        const platformInfo = getPlatformInfo();

        try {
          const resourceText = result?.content?.find(c => c.type === 'resource')?.resource?.text;
          if (resourceText) {
            const data = JSON.parse(resourceText);
            for (const doc of data.docs || []) {
              if (!doc.local_path || !doc.content) {
                skipped.push(doc.title);
                continue;
              }
              // Map stored path to current platform (macOS↔WSL↔Linux)
              const mappedPath = mapPathForCurrentPlatform(doc.local_path);
              try {
                const dir = path.dirname(mappedPath);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(mappedPath, doc.content, 'utf8');
                const pathChanged = mappedPath !== doc.local_path.replace(/^~/, process.env.HOME || '');
                const arrow = pathChanged ? ` (mapped from ${doc.local_path})` : '';
                written.push(`✅ ${doc.title} → ${mappedPath}${arrow}`);
              } catch (e) {
                errors.push(`❌ ${doc.title}: ${e.message}`);
              }
            }
          }
        } catch (e) {
          errors.push(`Parse error: ${e.message}`);
        }

        const summary = [
          `🖥️ Platform: ${platformInfo.platform} | Home: ${platformInfo.home} | Project key: ${platformInfo.homeProjectKey}`,
          written.length ? `\nWritten (${written.length}):\n${written.join('\n')}` : null,
          skipped.length ? `Skipped (no local_path): ${skipped.join(', ')}` : null,
          errors.length ? `Errors:\n${errors.join('\n')}` : null,
        ].filter(Boolean).join('\n\n');

        return [{ type: 'text', text: summary || 'No docs with local_path found.' }];
      }
    },
    {
      definition: listDevCategoriesDefinition(),
      handler: async (_args, { apiClient }) => {
        const result = await apiClient.callTool('list_dev_categories', {});
        return result;
      }
    },
    {
      definition: discoverClaudeSyncTargetsDefinition(),
      handler: async () => {
        const info = discoverSyncTargets();
        const lines = [`🔍 Claude dir: ${info.claude_dir}\n`];
        for (const [name, t] of Object.entries(info.targets)) {
          if (t.error) {
            lines.push(`  ${name.padEnd(14)} ⚠️  ${t.error}`);
            continue;
          }
          const samples = t.samples?.length ? ` — ${t.samples.join(', ')}${t.samples.length < t.file_count ? ', ...' : ''}` : '';
          lines.push(`  ${name.padEnd(14)} ${String(t.file_count).padStart(4)} items, ${t.total_bytes}b${samples}`);
        }
        return [{ type: 'text', text: lines.join('\n') }];
      }
    },
    {
      definition: pushClaudeFilesDefinition(
        'push_claude_skills',
        `Push ~/.claude/skills/ tree (each file as a dev_doc, category=skills).

Walks subdirectories. Each SKILL.md, reference, asset is uploaded separately
with local_path set so pull_dev_docs can restore on another machine.`
      ),
      handler: (args, ctx) => pushClaudeFilesHandler('skills', args, ctx)
    },
    {
      definition: pushClaudeFilesDefinition(
        'push_claude_agents',
        `Push ~/.claude/agents/ files (category=agents). Subagent definitions.`
      ),
      handler: (args, ctx) => pushClaudeFilesHandler('agents', args, ctx)
    },
    {
      definition: pushClaudeFilesDefinition(
        'push_claude_commands',
        `Push ~/.claude/commands/ tree (category=commands). Slash command definitions.`
      ),
      handler: (args, ctx) => pushClaudeFilesHandler('commands', args, ctx)
    },
    {
      definition: pushClaudeFilesDefinition(
        'push_claude_hooks',
        `Push ~/.claude/hooks/ tree (category=hooks). Event handler scripts.`
      ),
      handler: (args, ctx) => pushClaudeFilesHandler('hooks', args, ctx)
    },
    {
      definition: pushClaudeMcpServersDefinition(),
      handler: async (args, { apiClient }) => {
        const dryRun = args.dry_run === true;
        const { servers, source, exists } = readMcpServers();
        if (!exists) {
          return [{ type: 'text', text: `No ~/.claude.json found.` }];
        }
        const names = Object.keys(servers);
        if (dryRun) {
          return [{ type: 'text', text: `Would push mcpServers snapshot from ${source}\nServers (${names.length}): ${names.join(', ')}\n(would be encrypted: mcp category auto-encrypts)` }];
        }
        const plaintext = JSON.stringify({ mcpServers: servers }, null, 2);

        // mcp 카테고리 자동 암호화
        const recipients = await getAgeRecipients();
        if (recipients.length === 0) {
          return [{ type: 'text', text: `❌ No age recipients configured. Run sync_init_encryption (first machine) or sync_add_recipient (additional machines) before pushing secrets.` }];
        }
        const ciphertext = await encryptText(plaintext, { recipients });

        const result = await apiClient.callTool('create_dev_doc', {
          title: 'mcp-servers-snapshot.json',
          content: ciphertext,
          category: 'mcp',
          content_type: 'text',
          encrypted: true,
          encryption_meta: { scheme: 'age-armored', recipient_count: recipients.length },
          local_path: canonicalizePath(path.join(os.homedir(), '.claude/mcp-servers.d/from-ainote.json'))
        });
        return [{ type: 'text', text: `📤🔒 Pushed encrypted mcpServers snapshot (${names.length} servers, ${recipients.length} recipients): ${names.join(', ')}` }, ...(result?.content || [])];
      }
    },
    {
      definition: pullClaudeMcpServersDefinition(),
      handler: async (args, { apiClient }) => {
        const sidecarName = args.sidecar_name || 'from-ainote';
        const result = await apiClient.callTool('get_dev_doc', {
          title: 'mcp-servers-snapshot.json',
          category: 'mcp'
        });
        const resourceText = result?.content?.find(c => c.type === 'resource')?.resource?.text;
        let content;
        let isEncrypted = false;
        if (resourceText) {
          try {
            const parsedRes = JSON.parse(resourceText);
            content = parsedRes.content || parsedRes.doc?.content;
            isEncrypted = parsedRes.encrypted === true || parsedRes.doc?.encrypted === true;
          } catch {}
        }
        if (!content) {
          const textBlock = result?.content?.find(c => c.type === 'text')?.text;
          content = textBlock;
        }
        if (!content) {
          return [{ type: 'text', text: `❌ No mcp-servers-snapshot.json found in cloud (category: mcp). Run push_claude_mcp_servers first.` }];
        }
        // Auto-detect encryption if server didn't flag it (e.g. older docs)
        if (!isEncrypted && /-----BEGIN AGE ENCRYPTED FILE-----/.test(content)) {
          isEncrypted = true;
        }
        if (isEncrypted) {
          try {
            content = await decryptText(content);
          } catch (e) {
            return [{ type: 'text', text: `❌ Decryption failed: ${e.message}\nHint: ensure this machine's age identity is approved (sync_add_recipient on the original machine after re-push).` }];
          }
        }
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          return [{ type: 'text', text: `❌ Snapshot is not valid JSON after decrypt: ${e.message}` }];
        }
        const servers = parsed.mcpServers || parsed;
        const target = writeMcpServersSidecar(servers, { name: sidecarName });
        const names = Object.keys(servers);
        return [{
          type: 'text',
          text: [
            `📥 Wrote sidecar: ${target}`,
            `Servers (${names.length}): ${names.join(', ')}`,
            '',
            '⚠️  This does NOT activate the servers automatically.',
            'To merge into ~/.claude.json (after closing Claude):',
            `  jq -s '.[0] * .[1]' ~/.claude.json ${target} > ~/.claude.json.new && mv ~/.claude.json.new ~/.claude.json`
          ].join('\n')
        }];
      }
    },
    {
      definition: {
        name: 'sync_init_encryption',
        description: `Initialize age encryption on THIS machine (first-time setup).

Generates an age keypair, stores the secret key in OS keychain (or ~/.config/ainote/ fallback),
and sets this machine as the sole recipient. Run once per machine.

After running on the FIRST machine, share its public key (recipient) with subsequent machines
via sync_add_recipient so they can decrypt shared secrets.`,
        inputSchema: {
          type: 'object',
          properties: {
            force: { type: 'boolean', description: 'Regenerate even if identity already exists. WARNING: invalidates existing ciphertexts unless old recipients retained.' }
          }
        }
      },
      handler: async (args) => {
        const existing = await getAgeIdentity();
        if (existing && !args.force) {
          const recps = await getAgeRecipients();
          return [{ type: 'text', text: `✅ Already initialized.\nBackend: ${storageBackend()}\nRecipients: ${recps.length}\nPass force=true to regenerate.` }];
        }
        const { identity, recipient } = generateKeypair();
        await setAgeIdentity(identity);
        await addRecipient(recipient);
        return [{
          type: 'text',
          text: [
            `🔐 Encryption initialized`,
            `Backend: ${storageBackend()}`,
            `Your public key (share with other machines via sync_add_recipient):`,
            `  ${recipient}`,
            ``,
            `Next: on each other machine, run sync_init_encryption then back here run`,
            `  sync_add_recipient <their_public_key>`,
            `then re-push secrets so they're encrypted to all approved machines.`
          ].join('\n')
        }];
      }
    },
    {
      definition: {
        name: 'sync_add_recipient',
        description: `Add an age recipient (public key) to the encryption set for this machine.

Future encryptions on this machine will include this recipient.
Already-encrypted ciphertexts on the server are NOT re-encrypted retroactively —
call push_claude_mcp_servers again to re-encrypt with the updated recipient list.`,
        inputSchema: {
          type: 'object',
          properties: {
            recipient: { type: 'string', description: 'age public key (starts with age1...)' }
          },
          required: ['recipient']
        }
      },
      handler: async (args) => {
        const recipient = (args.recipient || '').trim();
        if (!/^age1[a-z0-9]+$/i.test(recipient)) {
          return [{ type: 'text', text: `❌ Invalid age recipient format. Expected: age1...` }];
        }
        const updated = await addRecipient(recipient);
        return [{ type: 'text', text: `✅ Recipient added.\nTotal recipients: ${updated.length}\n${updated.map(r => '  ' + r).join('\n')}` }];
      }
    },
    {
      definition: {
        name: 'sync_encryption_status',
        description: 'Show encryption setup status (backend, identity present, recipients, age binary).',
        inputSchema: { type: 'object', properties: {} }
      },
      handler: async () => {
        const identity = await getAgeIdentity();
        const recipients = await getAgeRecipients();
        let ageVer = 'not found';
        try {
          const { spawnSync } = await import('child_process');
          const r = spawnSync('age', ['--version'], { encoding: 'utf8' });
          if (r.status === 0) ageVer = (r.stdout || '').trim();
        } catch {}
        return [{
          type: 'text',
          text: [
            `🔐 Encryption status`,
            `  age binary:   ${ageVer}`,
            `  backend:      ${storageBackend()}`,
            `  identity:     ${identity ? 'present' : 'MISSING — run sync_init_encryption'}`,
            `  recipients:   ${recipients.length}`,
            ...recipients.map(r => `    - ${r}`)
          ].join('\n')
        }];
      }
    }
  ];
}
