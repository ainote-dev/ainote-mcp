# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.3.2] - 2026-05-14

### Added
- `ainote-mcp call <tool> [--key=value ...] [--json '<obj>']` subcommand for direct shell invocation of any of the 26 tools — bypasses Claude Desktop/Cursor and posts JSON-RPC `tools/call` to api.ainote.dev. Useful for scripts, alfred/raycast workflows, debugging, and automation that needs a single tool result.
  - JSON.parse-d flag values (`--limit=5` → integer 5)
  - `--json '<obj>'` for whole-payload form
  - `--raw` to print full JSON-RPC envelope
  - Resolves auth from `AINOTE_API_KEY` env or OS keychain (from `ainote-mcp login`)

### Server changes (released independently with the next ainote backend deploy)
- `resources/list` and `resources/read` now expose real user data via 5 URIs: `ainote://tasks`, `ainote://categories`, `ainote://dev-docs`, `ainote://handoffs`, `ainote://vaults`. Agents can `resources/read ainote://tasks` once at session start instead of polling `list_tasks` every turn.
- `resources/subscribe` / `resources/unsubscribe` accepted for spec compliance (return `subscriptionId`) but do NOT push notifications yet. SSE channel is deferred per the Phase 2 plan.

## [1.3.1] - 2026-05-14

### Added
- `mcpName` field in `package.json` (`io.github.seunghan91/ainote`) — required by the official [MCP Registry](https://registry.modelcontextprotocol.io) for ownership verification. Enables `mcp-publisher publish` to register ainote in the Anthropic-maintained registry.
- `server.json` (root of mcp-proxy) — MCP Registry metadata: stdio package + `streamable-http` remote (`https://api.ainote.dev/api/mcp`). Schema `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`.

### Note
- This patch release exists purely to attach the `mcpName` so the MCP Registry can verify package ownership. No tool-surface or behavior changes vs 1.3.0.

## [1.3.0] - 2026-05-14

### Added — MCP agent-friendliness
- **Tool annotations on every tool** (server-side, surfaces on `tools/list`): `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` (camelCase, per MCP spec). Autonomous agent runtimes can now gate destructive calls and retry idempotent ones without parsing prose. See [`docs/todo/MCP_TOOL_ANNOTATIONS_MAPPING.md`](https://github.com/seunghan91/ainote/blob/main/docs/todo/MCP_TOOL_ANNOTATIONS_MAPPING.md) for the full 26-tool table.
- **`handoff_save` / `handoff_get` accept optional `time` param** (HHMM, 24h KST). Multiple handoffs on the same `(project, topic, date)` are now disambiguated by appending `-HHMM` to the topic slug instead of overwriting.
- README: new **Annotations Reference** section explaining the four hints.
- README: new **Agent Compatibility** section with setup snippets for Claude Desktop / Claude Code / Cursor / Windsurf / ChatGPT / LangChain.
- README: extended **Available Tools** with `handoff_*`, `sync_*`, and `vault_*` (previously only tasks/dev-docs were documented).

### Changed
- Tool descriptions for 8 weakest entries (`delete_task`, `list_categories`, `delete_dev_doc`, `list_dev_categories`, `login_and_get_key`, `vault_list`, `vault_connect_status`, `handoff_list`, `handoff_get`) extended to 2–3 sentences each so unknown agents can decide whether to call them from `tools/list` alone. The new wording flags non-obvious side effects (key creation in `login_and_get_key`; 7-day stale purge in `handoff_list`/`get`).

### Server changes
- `app/controllers/api/mcp_controller.rb`: `MCP_TOOL_ANNOTATIONS` constant + `apply_tool_annotations!` helper decorate every `tools/list` response. `handoff_save` / `handoff_get` accept optional `time` HHMM.
- New spec `spec/requests/api/mcp_tool_annotations_spec.rb` verifying camelCase wire contract + representative mappings (delete_task, handoff_list, login_and_get_key, vault_sync, vault_create).

### Roadmap
- New `docs/todo/AGENT_INTEROP_ROADMAP_2026.md` capturing the 5-phase plan from Perplexity Deep Research (MCP modernization → OAuth 2.1 + DCR → A2A AgentCard → AGNTCY/Letta monitoring → marketplace registration). This release lands Phase 1.1 + part of 1.2; later phases are explicitly deferred and documented.

## [1.2.0] - 2026-05-13 — Claude environment sync (Phase A + B)

### Added
- `discover_claude_sync_targets`: read-only preview of what would be synced from `~/.claude/`
- `push_claude_skills` / `push_claude_agents` / `push_claude_commands` / `push_claude_hooks`: walk `~/.claude/<subdir>/` and upload each text file as a dev_doc with `local_path` set (so `pull_dev_docs` restores on another machine)
- `push_claude_mcp_servers`: snapshot `~/.claude.json` `mcpServers` to ainote cloud (category `mcp`), **auto-encrypted with age**
- `pull_claude_mcp_servers`: write decrypted snapshot to a **sidecar file** (`~/.claude/mcp-servers.d/from-ainote.json`) — never touches live-written `~/.claude.json` directly; emits a `jq` merge hint
- `sync_init_encryption`: generate age keypair on this machine, store in OS keychain, register self as recipient
- `sync_add_recipient`: add another machine's public key to the encryption set
- `sync_encryption_status`: show age binary version, keychain backend, identity presence, recipient list
- Internal modules: `internal/claude-scanner.js` (tree walker + sidecar writer), `internal/encryption.js` (age wrapper), `internal/keychain.js` (cross-keychain async wrapper with file fallback)
- `open` dep added for browser-based device-flow login (RFC 8628)

### Server changes
- Migration `20260513210000_add_encryption_to_papers`: adds `papers.encrypted` (boolean) + `papers.encryption_meta` (jsonb)
- `mcp_controller.rb`: `create_dev_doc`, `update_dev_doc`, `get_dev_doc`, `list_dev_docs`, `pull_dev_docs` now round-trip `encrypted` flag; list previews show `[encrypted]` instead of ciphertext

### Dependencies
- `cross-keychain ^1.1.0` (already in tree)
- Runtime requires `age` binary on PATH (install: `brew install age`)

## [1.0.2] - 2025-08-01

### Fixed
- Fixed MCP authentication issues by adding `skip_before_action :authenticate_api_user!` to McpStreamController
- Fixed McpUsageLog model association error by specifying `class_name: 'UserMcpKey'`
- Added 'mcp_proxy' to allowed client_type values in McpUsageLog validation

### Changed
- Improved API URL configuration to use Render default domain (https://ainote-5muq.onrender.com)
- Updated MCP authentication to consistently use MCP key authentication across all controllers

## [1.0.1] - 2025-07-01

### Added
- Initial release with basic task management features
- Support for creating, updating, deleting, and listing tasks
- Category management integration
- API key authentication

## [1.0.0] - 2025-06-15

### Added
- First version of AI Note MCP Server
- Basic integration with Claude Desktop
- Task management tools