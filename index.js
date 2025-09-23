#!/usr/bin/env node
/**
 * AI Note MCP Server - Claude Desktop Integration (stdio transport)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveAuthContext } from './lib/auth/strategy-factory.js';
import { createClaudeServer } from './lib/core/server-factory.js';

const transport = new StdioServerTransport();

let defaultAuthContext;

try {
  defaultAuthContext = resolveAuthContext('stdio');
} catch (error) {
  console.error(`[ainote-mcp] Authentication error: ${error.message}`);
  process.exitCode = 1;
  throw error;
}

const { server } = createClaudeServer({ defaultAuthContext });

await server.connect(transport);
console.error('AI Note MCP stdio server started (Claude Desktop compatible)');
