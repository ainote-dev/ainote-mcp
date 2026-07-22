import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import axios from 'axios';
import { getConfig } from '../core/config-manager.js';

/**
 * Interactive CLI signup for AI Note MCP.
 * Usage: ainote-mcp signup
 */
export async function runSignup() {
  const config = getConfig();
  const rl = readline.createInterface({ input, output });

  console.log('\n  AI Note MCP — Sign Up\n');

  try {
    const email = await rl.question('  Email: ');
    const password = await rl.question('  Password (min 6 chars): ');
    const name = await rl.question('  Name (optional, press Enter to skip): ');

    if (!email.trim() || !password.trim()) {
      console.error('\n  Error: Email and password are required.\n');
      process.exit(1);
    }

    if (password.trim().length < 6) {
      console.error('\n  Error: Password must be at least 6 characters.\n');
      process.exit(1);
    }

    console.log('\n  Creating account...');

    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'signup_and_get_key',
        arguments: {
          email: email.trim(),
          password: password.trim(),
          ...(name.trim() ? { name: name.trim() } : {})
        }
      }
    };

    const response = await axios.post(`${config.api.url}/api/mcp`, rpcRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const data = response.data?.data;

    // Check for JSON-RPC error
    if (data?.error) {
      console.error(`\n  Error: ${data.error.message}`);
      if (data.error.data?.suggestion) {
        console.log(`  Hint: ${data.error.data.suggestion}`);
      }
      console.log();
      process.exit(1);
    }

    // Extract MCP key from structured resource data
    const content = data?.result?.content;
    let mcpKey = null;

    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'resource' && item.resource?.text) {
          try {
            const resourceData = JSON.parse(item.resource.text);
            mcpKey = resourceData.mcp_key;
          } catch { /* ignore */ }
        }
      }
    }

    if (mcpKey) {
      console.log('\n  Account created successfully!\n');
      console.log(`  Your MCP API Key:\n`);
      console.log(`    ${mcpKey}\n`);
      console.log('  Add this to your MCP config:\n');
      console.log('  {');
      console.log('    "mcpServers": {');
      console.log('      "ainote": {');
      console.log('        "command": "npx",');
      console.log('        "args": ["-y", "@ainote/mcp"],');
      console.log('        "env": {');
      console.log(`          "AINOTE_API_KEY": "${mcpKey}"`);
      console.log('        }');
      console.log('      }');
      console.log('    }');
      console.log('  }\n');
      console.log('  Then restart Claude Desktop.\n');
    } else {
      // Fallback: print text content
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'text') {
            console.log(`\n${item.text}\n`);
          }
        }
      } else {
        console.log('\n  Account created! Check the response for your API key.\n');
      }
    }
  } catch (error) {
    if (error.response?.data) {
      console.error(`\n  Error: ${JSON.stringify(error.response.data)}\n`);
    } else {
      console.error(`\n  Error: ${error.message}\n`);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}
