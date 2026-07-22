#!/usr/bin/env node
/**
 * AI Note MCP Server — Claude Desktop integration (stdio transport).
 *
 * Also supports CLI subcommands:
 *   signup   — interactive account creation
 *   login    — device-authorization grant (RFC 8628)
 *   logout   — revoke + clear local credentials
 *   whoami   — show currently authenticated user
 */

const subcommand = process.argv[2];

if (subcommand === 'signup') {
  const { runSignup } = await import('./lib/cli/signup.js');
  await runSignup();
} else if (subcommand === 'login') {
  const { run } = await import('./lib/cli/login.js');
  await run();
} else if (subcommand === 'logout') {
  const { run } = await import('./lib/cli/logout.js');
  await run();
} else if (subcommand === 'whoami') {
  const { run } = await import('./lib/cli/whoami.js');
  await run();
} else if (subcommand === 'call') {
  // `ainote-mcp call <tool> [--key=value ...]` — direct shell invocation.
  // Bypasses the stdio MCP host and posts JSON-RPC tools/call to the API.
  const { run } = await import('./lib/cli/call.js');
  await run(process.argv.slice(3));
} else {
  // Default: start MCP stdio server
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { resolveAuthContext } = await import('./lib/auth/strategy-factory.js');
  const { createClaudeServer } = await import('./lib/core/server-factory.js');
  const { getConfigAsync } = await import('./lib/core/config-manager.js');

  // Hydrate AINOTE_API_KEY from the token store BEFORE auth context resolution
  // so existing sync `authenticateWithMcpKey()` paths see the stored credential.
  if (!process.env.AINOTE_API_KEY) {
    try {
      const cfg = await getConfigAsync();
      if (cfg.api.key) {
        process.env.AINOTE_API_KEY = cfg.api.key;
      }
    } catch { /* anonymous fallback handled below */ }
  }

  const transport = new StdioServerTransport();
  const defaultAuthContext = resolveAuthContext('stdio');

  if (defaultAuthContext.type === 'anonymous') {
    console.error('[ainote-mcp] No AINOTE_API_KEY found. Starting in onboarding mode.');
    console.error('[ainote-mcp] Run `npx @ainote/mcp login` (browser flow) or `npx @ainote/mcp signup`.');
  }

  const { server } = createClaudeServer({ defaultAuthContext });

  await server.connect(transport);
  console.error('AI Note MCP stdio server started (Claude Desktop compatible)');
}
