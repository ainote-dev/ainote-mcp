# AI Note MCP Server

[![npm version](https://badge.fury.io/js/%40ainote%2Fmcp-server.svg)](https://badge.fury.io/js/%40ainote%2Fmcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that connects AI assistants to your AI Note task management system. This package enables direct interaction with your AI Note tasks through natural language conversations in Claude Desktop and other MCP-compatible platforms.

> 📚 **[Complete Project Guide](../docs/PROJECT_GUIDE.md)** - 전체 프로젝트 가이드 및 아키텍처 정보

## Table of Contents

- [Access Methods](#access-methods)
- [Features](#features)
- [Authentication](#authentication)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [HTTP Endpoint](#http-endpoint)
- [Available Tools](#available-tools)
- [API Reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Access Methods

AI Note MCP server is available through three transport options to cover different integration scenarios:

### 1. **stdio Mode (This Package)** - For Personal Use
- **Installation**: `npm install -g @ainote/mcp`
- **Usage**: Claude Desktop and other stdio-based MCP clients
- **Setup**: Local installation with API key configuration
- **Best for**: Individual users connecting their personal AI Note account to Claude Desktop

### 2. **Local SSE Bridge (ChatGPT / MCP Apps)**
- **Command**: `ainote-mcp-http`
- **Protocol**: Server-Sent Events (SSE) + JSON-RPC over HTTP POST
- **Usage**: ChatGPT Model Context Protocol connectors, other SSE-capable MCP clients
- **Setup**: Run locally alongside your browser; supports API key or (optional) OAuth bearer tokens
- **Best for**: Users wanting to expose AI Note tools to ChatGPT without deploying infrastructure

### 3. **Hosted HTTP Endpoint** - For Platform Integration
- **URL**: `https://api.ainote.dev/api/mcp`
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Usage**: Platform integrations (Kakao PlayMCP, etc.)
- **Setup**: No installation required, direct API access
- **Best for**: Third-party platforms and services integrating AI Note functionality

All transports expose the same tool catalog. Choose the option that matches your hosting model and client capabilities.

## Features

- 📝 **Task Management**: Create, update, delete, and list tasks directly from Claude Desktop
- 📄 **Dev Docs**: Manage CLAUDE.md, Cursor rules, Windsurf rules, and dev documents centrally via MCP
- 🗂️ **Dev Category Hierarchy**: Auto-organized under `dev/` with subcategories (claude, cursor, windsurf, copilot, docs, skills, agents, commands, hooks, mcp)
- 🔄 **Claude Environment Sync**: Push/pull `~/.claude/` skills, agents, commands, hooks across machines (macOS/WSL/Linux)
- 🔐 **End-to-End Encryption**: `mcp` category (mcpServers + API keys) auto-encrypted client-side with age; server never sees plaintext
- 🪪 **OS Keychain Integration**: Per-machine age identity stored in macOS Keychain / libsecret / Credential Manager (file fallback supported)
- 🤝 **Session Handoffs**: `handoff_save` / `handoff_list` / `handoff_get` with optional `time: HHMM` for same-day disambiguation — saved under the primary vault, auto-purged after 7 days
- 📦 **Multi-Device File Sync**: `sync_push` / `sync_pull` / `sync_list` push markdown notes into the user's git-backed primary vault — works across macOS, Linux, iOS shortcuts
- 🏛️ **GitHub-Backed Vaults**: `vault_create` / `vault_clone` / `vault_sync` provision a private GitHub repo per vault; ainote indexes contents but never proxies git traffic
- 🛡️ **MCP Tool Annotations**: Every tool advertises `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` so autonomous agent runtimes can gate destructive calls
- 🏷️ **Category Support**: Organize tasks with categories
- 🔍 **Advanced Filtering**: 18+ filter options including date ranges, location, overdue tasks
- ⭐ **Priority Management**: Mark tasks as important
- 📅 **Smart Due Dates**: Human-readable format with relative time (e.g., `'26.1.25 14:30 - 오늘`)
- 🔒 **Dual Authentication**: Support for both User API Key (24-char) and MCP Key (64-char)
- 📊 **Usage Tracking**: Automatic API usage statistics per MCP key
- 🌊 **Streaming API**: Real-time streaming for bulk operations and large datasets
- 🤖 **Bot Integration**: Telegram bot support via Clawdbot + mcporter

## Quick Start (No Account Needed)

You can start using AI Note MCP **without an existing account**. The MCP server includes onboarding tools that let you sign up and get an API key directly from Claude:

### 1. Add to your MCP config (no API key yet)

```json
{
  "mcpServers": {
    "ainote": {
      "command": "npx",
      "args": ["-y", "@ainote/mcp"]
    }
  }
}
```

### 2. Restart Claude Desktop

### 3. Ask Claude to sign you up

> "Sign me up for AI Note with email user@example.com and password mypassword123"

Claude will call the `signup_and_get_key` tool and return your MCP API key.

### 4. Add the API key to your config

```json
{
  "mcpServers": {
    "ainote": {
      "command": "npx",
      "args": ["-y", "@ainote/mcp"],
      "env": {
        "AINOTE_API_KEY": "<your-key-from-step-3>"
      }
    }
  }
}
```

### 5. Restart Claude Desktop again

Now all tools (tasks, dev docs, etc.) are available.

### CLI Signup

You can also sign up directly from the terminal:

```bash
npx @ainote/mcp signup
```

This will interactively ask for email, password, and name, then return your MCP API key.

### CLI Tool Invocation (`call`)

Run any of the 26 ainote tools directly from the shell — no Claude / Cursor / MCP host required. Useful for scripts, alfred / raycast workflows, automation, and one-off queries.

```bash
# List all tasks due today
npx @ainote/mcp call list_tasks --due_today=true

# Save a handoff (JSON form)
npx @ainote/mcp call handoff_save \
  --json '{"project":"demo","topic":"poc","content":"..."}'

# Get a handoff
npx @ainote/mcp call handoff_get --project=demo --topic=poc

# Read a resource URI as JSON (load all tasks at once)
npx @ainote/mcp call list_tasks --limit=500
```

Flag parsing: `--key=value` is JSON.parse-d (numbers/booleans/null/arrays/objects work directly; raw strings fall back). Pass the entire arguments object via `--json '<obj>'`. Add `--raw` for the full JSON-RPC envelope.

Auth resolution order: `AINOTE_API_KEY` env var → OS keychain (from `ainote-mcp login`).

### Onboarding MCP Tools

These tools also work inside Claude (no API key needed):

| Tool | Description |
|------|-------------|
| `signup_and_get_key` | Create account + get MCP key |
| `login_and_get_key` | Login + get MCP key (existing account) |
| `get_setup_guide` | Setup instructions |

## Authentication

The CLI supports browser-based login as a more secure alternative to manually pasting API keys into your MCP config. Tokens and the MCP key are stored in the OS keychain.

### Quick start

```bash
ainote-mcp login                 # browser-based, recommended
ainote-mcp whoami                # verify current login
ainote-mcp logout                # revoke + clear keychain
```

### How it works

`ainote-mcp login` runs an [RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628) OAuth 2.0 Device Authorization Grant. The CLI generates a PKCE pair locally, opens your browser to sign in via the AI Note web app, and polls the backend until you approve. On success it stores an access token, a refresh token, and an MCP key in the OS keychain. The default MCP stdio mode automatically uses the stored MCP key — no `AINOTE_API_KEY` env var needed.

### Storage locations

| OS       | Location                                                                  |
|----------|---------------------------------------------------------------------------|
| macOS    | Keychain Access — service `@ainote/cli`                                   |
| Linux    | libsecret (gnome-keyring / kwallet) — service `@ainote/cli`               |
| Windows  | Credential Manager — target `@ainote/cli`                                 |
| Fallback | `${XDG_CONFIG_HOME:-~/.config}/ainote/credentials.json` (mode `0600`)     |

The fallback file is only used when no system keychain is available (e.g. headless servers without `libsecret`).

### CLI flags

- `--scope=mcp,read,write` — comma-separated scopes requested for the token (default: `mcp,read,write`)
- `--no-browser` — print the verification URL instead of auto-opening a browser (use this on SSH/CI)

### Environment overrides

- `AINOTE_API_URL` — backend URL (default `https://api.ainote.dev`)
- `AINOTE_API_KEY` — pre-provisioned MCP key. When set, the login flow is bypassed entirely and this key is used as-is.

### Headless / CI usage

For SSH sessions, devcontainers, or CI runners that cannot open a browser, use `--no-browser`. The CLI will print a short user code and a verification URL; open the URL on any device (laptop, phone) signed in to your AI Note account, approve the request, then return to the terminal:

```bash
$ ainote-mcp login --no-browser
Open this URL in any browser:
  https://ainote.dev/oauth/cli/device?user_code=BCDF-GHJK
Waiting for approval...
✓ Logged in as you@example.com
```

After login, subsequent invocations (`ainote-mcp`, `ainote-mcp whoami`) work normally with no further interaction.

### Troubleshooting

| Symptom                                       | Fix                                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------------------|
| `LOGIN_HINT` error on any subcommand          | Run `ainote-mcp login`                                                                    |
| macOS Keychain prompt every run               | Open Keychain Access, find `@ainote/cli`, set access control to "Always allow" for `node` |
| Browser does not open                         | Re-run with `--no-browser` and copy the URL manually                                      |
| Persistent 401 after login                    | Tokens were revoked server-side. Run `ainote-mcp login` again                             |
| `libsecret not available` on Linux            | Install `gnome-keyring` / `libsecret-1-0`, or rely on the file fallback (still encrypted at-rest by the OS) |

See [`docs/architecture/CLI_AUTH.md`](../docs/architecture/CLI_AUTH.md) for the full protocol specification, sequence diagram, and security model.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Claude Desktop with MCP support enabled

## Installation

### Option 1: Install from npm

```bash
npm install -g @ainote/mcp
```

### Option 2: Install from source

```bash
git clone https://github.com/ainote-dev/ainote-mcp.git
cd ainote-mcp-server
npm install
```

## Update

### Update from npm (Recommended)

To update to the latest version when installed via npm:

```bash
npm update -g @ainote/mcp
```

Or to install a specific version:

```bash
npm install -g @ainote/mcp@1.0.2
```

### Update from source

If you installed from source:

```bash
cd ainote-mcp-server
git pull origin main
npm install
```

After updating, **restart Claude Desktop** to load the new version.

## Configuration

To connect the MCP server with Claude Desktop, follow these steps.

### Step 1: Get your AI Note API Key

You need an API key from your AI Note account to allow Claude to access your tasks. You can find or generate your API key in the AI Note app's settings screen.

### Step 2: Configure Claude Desktop

Add the `ainote-mcp` server to your Claude Desktop configuration file. This file is located at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Open the file and add the following JSON block inside the `mcpServers` object. **Replace `your-api-key-here` with your actual AI Note API key.**

```json
{
  "mcpServers": {
    "ainote": {
      "command": "ainote-mcp",
      "env": {
        "AINOTE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

*Note: If you need to connect to a self-hosted or different AI Note server, you can add the `AINOTE_API_URL` environment variable as well.*

```json
"env": {
  "AINOTE_API_KEY": "your-api-key-here",
  "AINOTE_API_URL": "https://your-custom-api-url.com"
}
```

### Step 3: Restart Claude Desktop

After saving the configuration file, **restart Claude Desktop** completely. The new MCP server will be loaded, and you can start managing your AI Note tasks through Claude.


## Usage

Once configured, you can interact with your AI Note tasks through Claude:

### Example Conversations

```
You: "Show me my pending tasks"
Claude: I'll retrieve your pending tasks from AI Note...

You: "Create a new task to review the quarterly report by Friday"
Claude: I'll create that task for you with a due date set for Friday...

You: "Mark task ID 123 as completed"
Claude: I'll mark that task as completed...
```

## HTTP Endpoint

For platform integrations and services that prefer HTTP over stdio, AI Note provides a direct HTTP endpoint:

### Endpoint URL
```
POST https://api.ainote.dev/api/mcp
Content-Type: application/json
```

### Authentication
```http
Authorization: Bearer YOUR_API_KEY
```

### Request Format (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [...]
  },
  "id": 1
}
```

### Supported Methods
- `ping` - Health check
- `capabilities` - Server capabilities
- `tools/list` - List available tools
- `tools/call` - Execute a specific tool

### Platform Integration Examples
- **Kakao PlayMCP**: Use the HTTP endpoint for seamless integration
- **Custom Applications**: Build your own MCP client using the HTTP API
- **Enterprise Solutions**: Direct server-to-server communication

This HTTP endpoint provides identical functionality to the stdio version, making AI Note MCP accessible to a broader range of platforms and integration scenarios.

### 4. **Streaming API** - For Large Data Operations
- **URL**: `POST https://api.ainote.dev/api/mcp/stream`
- **Protocol**: Server-Sent Events (SSE)
- **Usage**: Bulk operations, large task lists, real-time progress
- **Best for**: Applications that need to handle large datasets or show progress indicators

#### Streaming Methods
| Method | Description |
|--------|-------------|
| `tasks/list` | Stream task list with filters |
| `tasks/create` | Create single task with progress |
| `tasks/analyze` | Get task statistics and insights |
| `tasks/bulk_update` | Update multiple tasks with progress |
| `tasks/bulk_create` | Create up to 1000 tasks at once |

#### Streaming Events
```
event: progress
data: {"status": "starting", "total": 100}

event: data
data: {"type": "task", "data": {...}}

event: result
data: {"status": "success", "count": 100}
```

### 5. **Telegram Bot Integration** - Via Clawdbot
- **Setup Guide**: [CLAWDBOT_SETUP.md](./CLAWDBOT_SETUP.md)
- **Tool**: mcporter for MCP server bridging
- **Usage**: Natural language task management in Telegram

```bash
# Quick setup
npm install -g mcporter
mcporter call ainote.list_tasks
```

### Local Development Bridge (`ainote-mcp-http`)

Run the bundled HTTP/SSE bridge when you need a local endpoint for ChatGPT or other MCP clients that speak SSE:

```bash
ainote-mcp-http
```

By default the server listens on `http://localhost:3030` and exposes two endpoints:

- `GET /sse` – establishes the SSE stream and returns the `sessionId`
- `POST /messages?sessionId=...` – receives JSON-RPC payloads from the client
- `GET /health` – simple health probe for monitoring

#### Configuration

Environment variable | Description | Default
---|---|---
`AINOTE_API_KEY` | API key used for MCP key authentication | **required**
`AINOTE_API_URL` | Target AI Note API base URL | `https://api.ainote.dev`
`AINOTE_MCP_HTTP_PORT` | Local port for the SSE server | `3030`
`AINOTE_MCP_ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins | _any_
`AINOTE_MCP_ALLOWED_HOSTS` | Comma-separated list of allowed `Host` headers | _any_
`AINOTE_ENABLE_OAUTH_AUTH` | Set to `true` to allow Bearer tokens (OAuth) | `false`

When OAuth is enabled the server expects `Authorization: Bearer ...` headers from the client and forwards them to the AI Note API.

## Available Tools

### list_tasks

List tasks from AI Note with advanced filtering options.

**Basic Parameters:**
- `status` (optional): Filter by status - "pending" or "completed"
- `limit` (optional): Maximum number of tasks (default: 25, max: 500)
- `search` (optional): Search keyword in task content
- `is_important` (optional): Filter important tasks only

**Location & Category:**
- `location` (optional): Filter by location (partial match, e.g., "여의도")
- `category_id` (optional): Filter by category UUID

**Date Range Filters:**
- `due_date_start` / `due_date_end`: Filter by due date range
- `completed_date_start` / `completed_date_end`: Filter by completion date
- `created_date_start` / `created_date_end`: Filter by creation date

**Special Filters:**
- `overdue` (optional): Filter overdue incomplete tasks
- `due_today` (optional): Filter tasks due today
- `has_notification` (optional): Filter by notification status

**Sorting:**
- `sort_by` (optional): Sort field - "due_date", "created_at", "completed_at", "updated_at", "is_important"
- `sort_order` (optional): Sort direction - "asc" or "desc"

### create_task

Create a new task in AI Note.

**Parameters:**
- `content` (required): Task description
- `is_important` (optional): Mark as important (boolean)
- `due_date` (optional): Due date in ISO format
- `category_id` (optional): Category ID to assign

### update_task

Update an existing task.

**Parameters:**
- `id` (required): Task ID
- `content` (optional): New task content
- `is_important` (optional): Update important status
- `completed_at` (optional): Mark as completed (ISO format) or null to uncomplete

### delete_task

Soft delete a task.

**Parameters:**
- `id` (required): Task ID to delete

### list_categories

List all available categories.

**Parameters:** None

---

### Dev Doc Tools (v1.1.0+)

Manage AI coding tool configuration files and dev documents centrally. All docs are organized under the `dev/` category hierarchy.

#### list_dev_docs

List dev documents with optional filtering.

**Parameters:**
- `category` (optional): Subcategory filter (claude, cursor, windsurf, copilot, docs)
- `search` (optional): Search keyword in document title
- `content_type` (optional): Filter by type - "markdown", "json", "yaml", "text"

#### get_dev_doc

Get a single dev document by title or id.

**Parameters:**
- `title` or `id` (one required): Document identifier
- `category` (optional): Subcategory to disambiguate title
- `include_versions` (optional): Include version history

#### create_dev_doc

Create a new dev document under `dev/` category.

**Parameters:**
- `title` (required): Document title (e.g., "project-a-claude.md")
- `content` (required): Document content
- `category` (optional): Subcategory (default: "docs")
- `content_type` (optional): Auto-detected from title extension

#### update_dev_doc

Update a dev document with replace, append, or prepend modes.

**Parameters:**
- `title` or `id` (one required): Document identifier
- `content` (required): New content
- `mode` (optional): "replace" (default), "append", or "prepend"

#### delete_dev_doc

Soft delete a dev document.

**Parameters:**
- `title` or `id` (one required): Document identifier

#### list_dev_categories

List all subcategories under `dev/` with document counts.

**Parameters:** None

#### Example: Store CLAUDE.md in ainote

```
You: "Save this project's CLAUDE.md content to ainote"
Claude: I'll create a dev doc in the claude category...
→ create_dev_doc(title: "myproject-claude.md", content: "...", category: "claude")

You: "Update my cursor rules in ainote"
Claude: I'll update the cursor rules doc...
→ update_dev_doc(title: "api-rules.mdc", category: "cursor", content: "...")

You: "Show me all my dev docs"
Claude: I'll list all documents under dev/...
→ list_dev_docs()
```

### Session Handoffs (cross-session / cross-device continuation)

Save a self-contained handoff note when the context window fills up or when you need to continue on another machine. Stored in the user's primary vault under `handoffs/`, auto-purged after 7 days.

| Tool | Purpose |
|------|---------|
| `handoff_save` | Write a handoff (`project`, `topic`, `content`, optional `date`, optional `time` HHMM for same-day disambiguation) |
| `handoff_list` | Most-recent-first list, optionally filtered by project. ⚠️ Triggers the 7-day stale purge as a side effect |
| `handoff_get` | Fetch by `project` + `topic` (+ optional `date`/`time`). Returns latest if `date` omitted. Same purge side effect |

```text
You: "Save a handoff for the logi-phase4 work I'm wrapping up"
Claude: → handoff_save({project: "logi", topic: "phase4", time: "1555", content: "..."})
       Stored at handoffs/logi-phase4-1555-2026-05-14.txt

(later, on the laptop):
You: "Pick up the logi-phase4 handoff"
Claude: → handoff_get({project: "logi", topic: "phase4"})
```

### Multi-Device File Sync (`sync_*` / `vault_sync`)

`sync_push` / `sync_pull` / `sync_list` operate on the user's git-backed primary vault. `vault_sync` is the unified entrypoint that accepts an `action: list|pull|push` argument.

| Tool | Purpose |
|------|---------|
| `sync_push` | Push a markdown note (path + content) into the vault repo |
| `sync_pull` | Read a markdown note from the vault by path |
| `sync_list` | Enumerate vault paths (optionally filtered) |
| `vault_sync` | Unified wrapper around the above three |

### GitHub-Backed Vaults

| Tool | Purpose |
|------|---------|
| `vault_list` | List the user's vaults + sync status + indexed file counts |
| `vault_create` | Create a new private vault as a GitHub repo (requires the ainote GitHub App install) |
| `vault_clone` | Return the git clone URL for an existing vault. ainote does **not** proxy git traffic — use your usual GitHub credentials |
| `vault_connect_status` | Check whether the ainote GitHub App is installed for this user; returns an install URL otherwise |

---

## Annotations Reference

Every tool advertises four MCP-spec annotations on `tools/list` so autonomous agent runtimes can reason about safety:

| Hint | Meaning | Agent action |
|------|---------|--------------|
| `readOnlyHint: true` | Tool does not mutate any server state | Safe to call without consent gates |
| `destructiveHint: true` | Tool deletes / overwrites / purges state | Require explicit user consent or transaction boundary |
| `idempotentHint: true` | Repeating the call with same args ends in the same state | Safe to retry on timeout / network error |
| `openWorldHint: true` | Tool reaches an external system (GitHub, SMTP, third-party) | Outcomes may be non-deterministic; cache cautiously |

**Notable annotations:**

- `handoff_list` / `handoff_get` are marked `destructiveHint: true` because they run a 7-day stale-handoff purge on every call.
- `login_and_get_key` is marked `readOnlyHint: false` because it creates a default MCP key when the user has none.
- `vault_sync` is conservatively `destructiveHint: true` because `action=push` with empty content can delete an indexed file.

See the source-of-truth mapping at [`docs/todo/MCP_TOOL_ANNOTATIONS_MAPPING.md`](https://github.com/seunghan91/ainote/blob/main/docs/todo/MCP_TOOL_ANNOTATIONS_MAPPING.md) in the ainote repo.

---

## Agent Compatibility

ainote MCP works with any client that speaks Model Context Protocol over stdio or HTTP. Tested setups:

### Claude Desktop / Claude Code (stdio via this npm package)

```json
{
  "mcpServers": {
    "ainote": {
      "command": "npx",
      "args": ["-y", "@ainote/mcp"],
      "env": { "AINOTE_API_KEY": "..." }
    }
  }
}
```

### Claude Code (direct HTTP — recommended for full feature set)

```json
{
  "mcpServers": {
    "ainote": {
      "type": "http",
      "url": "https://api.ainote.dev/api/mcp",
      "headers": { "Authorization": "McpKey <YOUR_MCP_KEY>" }
    }
  }
}
```

> The `type: "http"` field is required — without it, Claude Code's user-level MCP loader silently rejects the entire `mcpServers` block.

### Cursor / Windsurf (stdio)

Same as Claude Desktop config — both editors accept the `command + args + env` shape.

### ChatGPT / OpenAI Custom GPTs

Use the hosted HTTP endpoint via OpenAI Connectors or Custom GPT Actions. The MCP JSON-RPC body works as a regular HTTPS POST. An OpenAPI 3.1 mirror of the tool surface is planned (see `docs/todo/AGENT_INTEROP_ROADMAP_2026.md` Phase 1.4).

### LangChain / LangGraph

Wrap the HTTP endpoint as a remote tool. Pass `Authorization: McpKey <YOUR_MCP_KEY>` and POST JSON-RPC requests. Tool definitions can be discovered via `tools/list`.

---

## API Reference

The MCP server communicates with the AI Note API using the following endpoints:

- `GET /api/mcp/tasks` - List tasks
- `POST /api/mcp/tasks` - Create task
- `PUT /api/mcp/tasks/:id` - Update task
- `DELETE /api/mcp/tasks/:id` - Delete task
- `GET /api/mcp/categories` - List categories

All requests require authentication via the `Authorization` header with your API key.

## Development

### Running Locally

```bash
# Clone the repository
git clone https://github.com/ainote-dev/ainote-mcp.git
cd ainote-mcp-server

# Install dependencies
npm install

# Run the server
npm start
```

### Testing with Claude Desktop

1. Update your Claude Desktop config to point to your local development server
2. Set environment variables for testing
3. Restart Claude Desktop
4. Check the MCP connection status in Claude Desktop settings

### Project Structure

```
ainote-mcp-server/
├── index.js          # Main server implementation
├── package.json      # Package configuration
├── README.md         # English documentation
├── README-ko.md      # Korean documentation
└── LICENSE           # MIT license
```

## Troubleshooting

### Common Issues

1. **"API key not found" error**
   - Ensure `AINOTE_API_KEY` is set in your environment or Claude config
   - Check that the API key is valid and has proper permissions

2. **"Connection refused" error**
   - Verify the API URL is correct
   - Check network connectivity
   - Ensure the AI Note API server is running

3. **"Tool not found" error**
   - Restart Claude Desktop after configuration changes
   - Verify the MCP server is properly configured in Claude Desktop

4. **Tasks not appearing**
   - Check API key permissions
   - Verify you're querying the correct status (pending/completed)
   - Try using the search parameter

### Debug Mode

To enable debug logging:

```bash
export DEBUG=mcp:*
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@ainote.dev
- 🐛 Issues: [GitHub Issues](https://github.com/ainote-dev/ainote-mcp/issues)
- 💬 Discord: [Join our community](https://discord.gg/ainote)

## Acknowledgments

- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [AI Note](https://ainote.dev)
- Made for [Claude Desktop](https://claude.ai/desktop)