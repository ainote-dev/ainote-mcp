#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_KEY = process.env.AINOTE_API_KEY;
const API_URL = process.env.AINOTE_API_URL || 'https://ainote-5muq.onrender.com';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Create MCP server
const server = new Server(
  {
    name: 'ainote-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_tasks',
        description: 'List tasks from AI Note',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'completed'],
              description: 'Filter by task status'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return (default: 25, max: 500)'
            },
            search: {
              type: 'string',
              description: 'Search keyword in task content'
            }
          }
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task in AI Note',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Task content'
            },
            is_important: {
              type: 'boolean',
              description: 'Mark task as important'
            },
            due_date: {
              type: 'string',
              description: 'Due date in ISO format'
            },
            category_id: {
              type: 'string',
              description: 'Category ID'
            }
          },
          required: ['content']
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID'
            },
            content: {
              type: 'string',
              description: 'New task content'
            },
            is_important: {
              type: 'boolean',
              description: 'Update important status'
            },
            completed_at: {
              type: 'string',
              description: 'Mark as completed (ISO format) or null to uncomplete'
            }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_task',
        description: 'Delete a task (soft delete)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID to delete'
            }
          },
          required: ['id']
        }
      },
      {
        name: 'list_categories',
        description: 'List all categories',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_tasks': {
        const response = await api.get('/api/mcp/tasks', {
          params: args
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'create_task': {
        const response = await api.post('/api/mcp/tasks', {
          task: args
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'update_task': {
        const { id, ...updateData } = args;
        const response = await api.put(`/api/mcp/tasks/${id}`, {
          task: updateData
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'delete_task': {
        const response = await api.delete(`/api/mcp/tasks/${args.id}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'list_categories': {
        const response = await api.get('/api/mcp/categories');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n${error.response?.data ? JSON.stringify(error.response.data, null, 2) : ''}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('AI Note MCP proxy server started');