# AI Note MCP Server

[![npm version](https://badge.fury.io/js/%40ainote%2Fmcp-server.svg)](https://badge.fury.io/js/%40ainote%2Fmcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that connects Claude Desktop to your AI Note task management system. This server allows Claude to directly interact with your AI Note tasks, enabling task creation, updates, and management through natural language conversations.

<a href="https://glama.ai/mcp/servers/@ainote-dev/ainote-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@ainote-dev/ainote-mcp/badge" alt="AI Note Server MCP server" />
</a>

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Available Tools](#available-tools)
- [API Reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- 📝 **Task Management**: Create, update, delete, and list tasks directly from Claude Desktop
- 🏷️ **Category Support**: Organize tasks with categories
- 🔍 **Advanced Search**: Search tasks by content, status, and more
- ⭐ **Priority Management**: Mark tasks as important
- 📅 **Due Date Support**: Set and manage task due dates
- 🔒 **Secure API Integration**: Uses API key authentication for secure access

## Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- AI Note API access (API key required)
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

## Available Tools

### list_tasks

List tasks from AI Note with filtering options.

**Parameters:**
- `status` (optional): Filter by status - "pending" or "completed"
- `limit` (optional): Maximum number of tasks (default: 25, max: 500)
- `search` (optional): Search keyword in task content

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