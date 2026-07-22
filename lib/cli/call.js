/**
 * `ainote-mcp call <tool> [--key=value ...] [--json '<obj>']`
 *
 * Direct shell invocation of an ainote MCP tool — no agent required. Useful for:
 *   - one-off CLI use, scripts, alfred/raycast workflows
 *   - debugging tool responses without spinning up Claude
 *   - automation that wants a single tool result, not an interactive loop
 *
 * Resolves the MCP key from (in order):
 *   1. AINOTE_API_KEY env
 *   2. token store (mcpKey written by `ainote-mcp login`)
 *
 * Posts JSON-RPC 2.0 `tools/call` to AINOTE_API_URL (default https://api.ainote.dev/api/mcp).
 *
 * Argument parsing supports two styles, in priority order:
 *   --json '{"due_today": true}'    raw JSON object as arguments
 *   --key=value                      one flag per top-level field; values are
 *                                    JSON.parse-d (so `--limit=5` is 5, not "5";
 *                                    `--name=hello` falls back to the raw string
 *                                    if JSON.parse fails)
 *
 * Output:
 *   default — pretty JSON of the tool's result content
 *   --raw   — entire JSON-RPC envelope
 */
import process from 'node:process';
import axios from 'axios';
import { getCredentials } from '../auth/token-store.js';

const DEFAULT_API_URL = 'https://api.ainote.dev';

function parseArgs(argv) {
  // argv shape: [toolName, ...flags]
  const toolName = argv[0];
  const flags = argv.slice(1);
  const out = { tool: toolName, args: {}, raw: false, help: false };

  for (let i = 0; i < flags.length; i++) {
    const a = flags[i];
    if (a === '--raw') { out.raw = true; continue; }
    if (a === '-h' || a === '--help') { out.help = true; continue; }
    if (a === '--json') {
      const next = flags[++i];
      if (!next) throw new Error('--json requires a JSON object argument');
      let parsed;
      try { parsed = JSON.parse(next); }
      catch (e) { throw new Error(`--json value is not valid JSON: ${e.message}`); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('--json value must be a JSON object');
      }
      out.args = { ...out.args, ...parsed };
      continue;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key, rawVal;
      if (eq > 0) {
        key = a.slice(2, eq);
        rawVal = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        rawVal = flags[++i];
        if (rawVal === undefined) {
          out.args[key] = true;
          continue;
        }
      }
      // Try JSON.parse first (numbers, booleans, null, arrays/objects),
      // fall back to raw string.
      let value;
      try { value = JSON.parse(rawVal); }
      catch { value = rawVal; }
      out.args[key] = value;
      continue;
    }
    throw new Error(`unexpected positional argument: ${a}`);
  }

  return out;
}

function printHelp() {
  const help = `\
Usage: ainote-mcp call <tool> [options]

Direct shell invocation of an ainote MCP tool over HTTP. Bypasses any
running MCP host (Claude Desktop, Cursor, etc.) and posts directly to
api.ainote.dev — useful for scripts and one-off queries.

Authentication:
  - AINOTE_API_KEY env var, OR
  - mcp key from \`ainote-mcp login\` (stored in OS keychain)

Options:
  --key=value           pass an argument to the tool (JSON.parse-d, falls
                        back to string). Repeatable.
  --json '<obj>'        pass the entire arguments object as JSON. Merged
                        with any --key=value flags (--key=value wins on
                        conflict).
  --raw                 print the full JSON-RPC envelope instead of just
                        the result content.
  -h, --help            this help.

Examples:
  ainote-mcp call list_tasks --due_today=true
  ainote-mcp call list_tasks --limit=5 --status=pending
  ainote-mcp call handoff_save \\
    --json '{"project":"demo","topic":"poc","content":"..."}'
  ainote-mcp call handoff_get --project=demo --topic=poc
  ainote-mcp call list_dev_categories
`;
  process.stdout.write(help);
}

export async function run(argv) {
  // argv: everything after the `call` subcommand
  if (!argv || argv.length === 0) {
    printHelp();
    process.exit(1);
    return;
  }

  let parsed;
  try { parsed = parseArgs(argv); }
  catch (e) {
    console.error(`error: ${e.message}\n`);
    printHelp();
    process.exit(2);
    return;
  }

  if (parsed.help || !parsed.tool || parsed.tool.startsWith('-')) {
    printHelp();
    process.exit(parsed.help ? 0 : 1);
    return;
  }

  const apiUrl = (process.env.AINOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

  let mcpKey = process.env.AINOTE_API_KEY;
  if (!mcpKey) {
    const creds = await getCredentials(apiUrl);
    mcpKey = creds?.mcpKey;
  }
  if (!mcpKey) {
    console.error('error: no MCP key. Run `ainote-mcp login` or set AINOTE_API_KEY.');
    process.exit(3);
    return;
  }

  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: parsed.tool, arguments: parsed.args }
  };

  let response;
  try {
    response = await axios.post(`${apiUrl}/api/mcp`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `McpKey ${mcpKey}`,
        Accept: 'application/json'
      },
      timeout: 60000,
      validateStatus: () => true
    });
  } catch (e) {
    console.error(`error: request failed: ${e.message}`);
    process.exit(4);
    return;
  }

  if (response.status >= 400 && response.status !== 200) {
    console.error(`error: HTTP ${response.status}`);
    console.error(JSON.stringify(response.data, null, 2));
    process.exit(5);
    return;
  }

  const env = response.data || {};
  if (env.error) {
    console.error(`error: ${env.error.message || 'unknown'} (code ${env.error.code})`);
    if (env.error.data) console.error(JSON.stringify(env.error.data, null, 2));
    process.exit(6);
    return;
  }

  if (parsed.raw) {
    console.log(JSON.stringify(env, null, 2));
    return;
  }

  // Default: print just the result.content[] payload(s) so shell pipelines
  // can grep / jq directly without the JSON-RPC envelope noise.
  const content = env?.result?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object' && 'text' in block) {
        console.log(block.text);
      } else {
        console.log(JSON.stringify(block, null, 2));
      }
    }
    return;
  }

  // Fallback — some tools may emit a non-standard shape; dump result.
  console.log(JSON.stringify(env.result ?? env, null, 2));
}
