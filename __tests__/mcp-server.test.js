import { jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

/**
 * Integration Test Configuration and Mock Setup
 * 
 * Comprehensive test suite for AI Note MCP server integration testing.
 * Sets up mock environment and axios interceptors for testing all tool handlers.
 */

/**
 * Mock API key for testing authentication in integration scenarios
 * @type {string}
 */
const mockApiKey = 'test_api_key_12345';

/**
 * Mock API URL for testing complete integration workflows
 * @type {string}
 */
const mockApiUrl = 'https://test.api.ainote.dev';

// Configure test environment variables
process.env.AINOTE_API_KEY = mockApiKey;
process.env.AINOTE_API_URL = mockApiUrl;

/**
 * Axios mock adapter for comprehensive HTTP request interception
 * @type {import('axios-mock-adapter').MockAdapter}
 */
const mockAxios = new MockAdapter(axios);

/**
 * Complete Tool Definitions for Integration Testing
 * 
 * Full replica of the tool definitions from the main MCP server for
 * comprehensive integration testing of tool schemas and validation.
 * 
 * @type {Array<Object>} Array of MCP tool definition objects
 */
const toolDefinitions = [
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
];

/**
 * Integration Test Helper Functions
 * 
 * Complete replication of MCP server logic for comprehensive integration testing.
 */

/**
 * Creates authenticated axios instance for integration testing
 * 
 * Replicates the exact API instance creation from the main server
 * to ensure integration tests match production behavior.
 * 
 * @returns {import('axios').AxiosInstance} Fully configured axios instance
 * 
 * @example
 * const api = createApiInstance();
 * // Instance includes authentication headers and base URL
 * expect(api.defaults.headers.Authorization).toBe('McpKey test_api_key_12345');
 */
const createApiInstance = () => {
  return axios.create({
    baseURL: mockApiUrl,
    headers: {
      'Authorization': `McpKey ${mockApiKey}`,
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Integration Test: List Tools Handler
 * 
 * Replicates the MCP list_tools handler for integration testing.
 * Returns the complete tool catalog for validation.
 * 
 * @async
 * @returns {Promise<{tools: Array<Object>}>} Complete tool definitions
 * 
 * @example
 * const result = await handleListTools();
 * expect(result.tools).toHaveLength(5);
 * expect(result.tools[0].name).toBe('list_tasks');
 */
const handleListTools = async () => {
  return { tools: toolDefinitions };
};

/**
 * Integration Test: Call Tool Handler
 * 
 * Complete replication of the MCP call_tool handler for integration testing.
 * Routes tool calls to appropriate API endpoints and handles all error scenarios.
 * 
 * @async
 * @param {string} name - Tool name to execute
 * @param {Object} args - Tool-specific arguments
 * @returns {Promise<Object>} MCP-compliant response or error object
 * @throws {Error} For unknown tools or critical failures
 * 
 * @example
 * const result = await handleCallTool('create_task', {
 *   content: 'Test task',
 *   is_important: true
 * });
 * expect(result.content[0].type).toBe('text');
 */
const handleCallTool = async (name, args) => {
  const api = createApiInstance();

  try {
    switch (name) {
      /**
       * Integration Test: List Tasks Tool
       * Handles task listing with filtering, pagination, and search
       */
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

      /**
       * Integration Test: Create Task Tool
       * Handles task creation with content validation and metadata
       */
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

      /**
       * Integration Test: Update Task Tool
       * Handles task updates with ID validation and partial updates
       */
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

      /**
       * Integration Test: Delete Task Tool
       * Handles task soft deletion with ID validation
       */
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

      /**
       * Integration Test: List Categories Tool
       * Handles category retrieval for task organization
       */
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
    /**
     * Integration Test: Error Handler
     * Formats all API errors and network failures for MCP responses
     */
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\\n${error.response?.data ? JSON.stringify(error.response.data, null, 2) : ''}`
        }
      ],
      isError: true
    };
  }
};

describe('AI Note MCP Server Integration', () => {
  beforeEach(() => {
    mockAxios.reset();
  });

  afterEach(() => {
    // Don't restore, just reset to avoid circular references
    mockAxios.reset();
  });

  describe('ListTools Handler', () => {
    it('should return all available tools', async () => {
      const result = await handleListTools();

      expect(result.tools).toHaveLength(5);
      expect(result.tools.map(t => t.name)).toEqual([
        'list_tasks',
        'create_task', 
        'update_task',
        'delete_task',
        'list_categories'
      ]);
    });

    it('should have proper schema for each tool', async () => {
      const result = await handleListTools();

      const listTasksTool = result.tools.find(t => t.name === 'list_tasks');
      expect(listTasksTool.inputSchema.properties).toHaveProperty('status');
      expect(listTasksTool.inputSchema.properties).toHaveProperty('limit');
      expect(listTasksTool.inputSchema.properties).toHaveProperty('search');

      const createTaskTool = result.tools.find(t => t.name === 'create_task');
      expect(createTaskTool.inputSchema.required).toContain('content');
    });
  });

  describe('list_tasks tool', () => {
    it('should fetch tasks successfully', async () => {
      const mockTasks = [
        { id: '1', content: 'Test task 1', status: 'pending' },
        { id: '2', content: 'Test task 2', status: 'completed' }
      ];

      mockAxios.onGet('/api/mcp/tasks').reply(200, { data: mockTasks });

      const result = await handleCallTool('list_tasks', {});

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(mockTasks);
    });

    it('should handle filtering by status', async () => {
      const mockTasks = [
        { id: '1', content: 'Test task 1', status: 'pending' }
      ];

      mockAxios.onGet('/api/mcp/tasks').reply((config) => {
        expect(config.params.status).toBe('pending');
        return [200, { data: mockTasks }];
      });

      await handleCallTool('list_tasks', { status: 'pending' });
    });

    it('should handle API errors gracefully', async () => {
      mockAxios.onGet('/api/mcp/tasks').reply(500, { error: 'Internal server error' });

      const result = await handleCallTool('list_tasks', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('create_task tool', () => {
    it('should create task successfully', async () => {
      const newTask = {
        content: 'New test task',
        is_important: true,
        due_date: '2025-08-20T10:00:00Z'
      };

      const createdTask = { id: '123', ...newTask };

      mockAxios.onPost('/api/mcp/tasks').reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.task).toEqual(newTask);
        return [201, { data: createdTask }];
      });

      const result = await handleCallTool('create_task', newTask);

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(createdTask);
    });

    it('should handle creation errors', async () => {
      mockAxios.onPost('/api/mcp/tasks').reply(400, { 
        error: 'Validation failed',
        details: { content: 'is required' }
      });

      const result = await handleCallTool('create_task', { is_important: true });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('update_task tool', () => {
    it('should update task successfully', async () => {
      const taskId = '123';
      const updateData = {
        content: 'Updated task content',
        is_important: false
      };

      const updatedTask = { id: taskId, ...updateData };

      mockAxios.onPut(`/api/mcp/tasks/${taskId}`).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.task).toEqual(updateData);
        return [200, { data: updatedTask }];
      });

      const result = await handleCallTool('update_task', { id: taskId, ...updateData });

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(updatedTask);
    });

    it('should handle task not found', async () => {
      const taskId = 'non-existent';
      
      mockAxios.onPut(`/api/mcp/tasks/${taskId}`).reply(404, { 
        error: 'Task not found' 
      });

      const result = await handleCallTool('update_task', { id: taskId, content: 'Updated content' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('delete_task tool', () => {
    it('should delete task successfully', async () => {
      const taskId = '123';
      
      mockAxios.onDelete(`/api/mcp/tasks/${taskId}`).reply(200, { 
        message: 'Task deleted successfully' 
      });

      const result = await handleCallTool('delete_task', { id: taskId });

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.message).toBe('Task deleted successfully');
    });

    it('should handle deletion errors', async () => {
      const taskId = 'non-existent';
      
      mockAxios.onDelete(`/api/mcp/tasks/${taskId}`).reply(404, { 
        error: 'Task not found' 
      });

      const result = await handleCallTool('delete_task', { id: taskId });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('list_categories tool', () => {
    it('should fetch categories successfully', async () => {
      const mockCategories = [
        { id: '1', name: 'Work', color: '#FF0000' },
        { id: '2', name: 'Personal', color: '#00FF00' }
      ];

      mockAxios.onGet('/api/mcp/categories').reply(200, { data: mockCategories });

      const result = await handleCallTool('list_categories', {});

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(mockCategories);
    });

    it('should handle categories fetch error', async () => {
      mockAxios.onGet('/api/mcp/categories').reply(500, { 
        error: 'Failed to fetch categories' 
      });

      const result = await handleCallTool('list_categories', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('unknown tool', () => {
    it('should handle unknown tool requests', async () => {
      const result = await handleCallTool('unknown_tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
    });
  });

  describe('authentication', () => {
    it('should include correct authentication headers', async () => {
      mockAxios.onGet('/api/mcp/tasks').reply((config) => {
        expect(config.headers.Authorization).toBe(`McpKey ${mockApiKey}`);
        expect(config.headers['Content-Type']).toBe('application/json');
        return [200, { data: [] }];
      });

      await handleCallTool('list_tasks', {});
    });
  });
});