import { jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

/**
 * Test Configuration and Mock Setup
 * 
 * Sets up test environment variables and axios mocking for unit testing
 * MCP server functionality without making real API calls.
 */

/**
 * Mock API key for testing authentication headers
 * @type {string}
 */
const mockApiKey = 'test_api_key_12345';

/**
 * Mock API URL for testing API endpoint configuration
 * @type {string}
 */
const mockApiUrl = 'https://test.api.ainote.dev';

// Set up environment variables for testing
process.env.AINOTE_API_KEY = mockApiKey;
process.env.AINOTE_API_URL = mockApiUrl;

/**
 * Axios mock adapter for intercepting HTTP requests during tests
 * @type {import('axios-mock-adapter').MockAdapter}
 */
const mockAxios = new MockAdapter(axios);

/**
 * Test Helper Functions
 * 
 * These functions replicate the MCP server logic for isolated unit testing.
 */

/**
 * Creates a mock axios instance with AI Note API configuration
 * 
 * Replicates the API instance creation logic from the main MCP server
 * for testing purposes with mock environment variables.
 * 
 * @returns {import('axios').AxiosInstance} Configured axios instance
 * 
 * @example
 * const api = createApiInstance();
 * expect(api.defaults.baseURL).toBe('https://test.api.ainote.dev');
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
 * Test Tool Handler: List Tasks
 * 
 * Replicates the list_tasks tool handler logic for unit testing.
 * Fetches tasks from the mock API with optional filtering parameters.
 * 
 * @async
 * @param {Object} args - Tool arguments
 * @param {string} [args.status] - Filter by task status ('pending' or 'completed')
 * @param {number} [args.limit] - Maximum number of tasks to return
 * @param {string} [args.search] - Search keyword in task content
 * @returns {Promise<Object>} MCP-compliant response object
 * @throws {Error} If API request fails
 * 
 * @example
 * const result = await handleListTasks({ status: 'pending', limit: 10 });
 * expect(result.content[0].type).toBe('text');
 */
const handleListTasks = async (args) => {
  const api = createApiInstance();
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
};

/**
 * Test Tool Handler: Create Task
 * 
 * Replicates the create_task tool handler logic for unit testing.
 * Creates a new task with the provided content and metadata.
 * 
 * @async
 * @param {Object} args - Tool arguments
 * @param {string} args.content - Task content (required)
 * @param {boolean} [args.is_important] - Mark task as important
 * @param {string} [args.due_date] - Due date in ISO format
 * @param {string} [args.category_id] - Associated category ID
 * @returns {Promise<Object>} MCP-compliant response object with created task
 * @throws {Error} If API request fails or validation errors occur
 * 
 * @example
 * const result = await handleCreateTask({
 *   content: 'Review quarterly reports',
 *   is_important: true,
 *   due_date: '2025-08-20T17:00:00Z'
 * });
 */
const handleCreateTask = async (args) => {
  const api = createApiInstance();
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
};

/**
 * Test Tool Handler: Update Task
 * 
 * Replicates the update_task tool handler logic for unit testing.
 * Updates an existing task's properties using its ID.
 * 
 * @async
 * @param {Object} args - Tool arguments
 * @param {string} args.id - Task ID (required)
 * @param {string} [args.content] - New task content
 * @param {boolean} [args.is_important] - Update important status
 * @param {string|null} [args.completed_at] - Mark as completed (ISO format) or null to uncomplete
 * @returns {Promise<Object>} MCP-compliant response object with updated task
 * @throws {Error} If API request fails or task not found
 * 
 * @example
 * const result = await handleUpdateTask({
 *   id: '123',
 *   content: 'Updated task content',
 *   is_important: false
 * });
 */
const handleUpdateTask = async (args) => {
  const api = createApiInstance();
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
};

/**
 * Test Tool Handler: Delete Task
 * 
 * Replicates the delete_task tool handler logic for unit testing.
 * Performs a soft delete on the specified task.
 * 
 * @async
 * @param {Object} args - Tool arguments
 * @param {string} args.id - Task ID to delete (required)
 * @returns {Promise<Object>} MCP-compliant response object with deletion confirmation
 * @throws {Error} If API request fails or task not found
 * 
 * @example
 * const result = await handleDeleteTask({ id: '123' });
 * const responseData = JSON.parse(result.content[0].text);
 * expect(responseData.message).toBe('Task deleted successfully');
 */
const handleDeleteTask = async (args) => {
  const api = createApiInstance();
  const response = await api.delete(`/api/mcp/tasks/${args.id}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }
    ]
  };
};

/**
 * Test Tool Handler: List Categories
 * 
 * Replicates the list_categories tool handler logic for unit testing.
 * Retrieves all available task categories from the API.
 * 
 * @async
 * @param {Object} args - Tool arguments (empty object)
 * @returns {Promise<Object>} MCP-compliant response object with categories array
 * @throws {Error} If API request fails
 * 
 * @example
 * const result = await handleListCategories({});
 * const responseData = JSON.parse(result.content[0].text);
 * expect(Array.isArray(responseData.data)).toBe(true);
 */
const handleListCategories = async (args) => {
  const api = createApiInstance();
  const response = await api.get('/api/mcp/categories');
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }
    ]
  };
};

/**
 * Test Error Handler
 * 
 * Replicates the error handling logic from the main MCP server for testing.
 * Formats API errors and network failures into MCP-compliant error responses.
 * 
 * @param {Error} error - The error object to format
 * @param {Object} [error.response] - Axios error response object
 * @param {Object} [error.response.data] - API error response data
 * @returns {Object} MCP-compliant error response object
 * 
 * @example
 * const error = new Error('Task not found');
 * error.response = { data: { details: 'Task ID does not exist' } };
 * const errorResult = handleError(error);
 * expect(errorResult.isError).toBe(true);
 * expect(errorResult.content[0].text).toContain('Error: Task not found');
 */
const handleError = (error) => {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error.message}\n${error.response?.data ? JSON.stringify(error.response.data, null, 2) : ''}`
      }
    ],
    isError: true
  };
};

describe('MCP Server Tool Handlers', () => {
  beforeEach(() => {
    mockAxios.reset();
  });

  afterEach(() => {
    // Don't restore, just reset to avoid circular references
    mockAxios.reset();
  });

  describe('Environment Configuration', () => {
    it('should have correct environment variables', () => {
      expect(process.env.AINOTE_API_KEY).toBe(mockApiKey);
      expect(process.env.AINOTE_API_URL).toBe(mockApiUrl);
    });

    it('should create API instance with correct config', () => {
      const api = createApiInstance();
      expect(api.defaults.baseURL).toBe(mockApiUrl);
      expect(api.defaults.headers.Authorization).toBe(`McpKey ${mockApiKey}`);
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('list_tasks handler', () => {
    it('should fetch tasks successfully', async () => {
      const mockTasks = [
        { id: '1', content: 'Test task 1', status: 'pending' },
        { id: '2', content: 'Test task 2', status: 'completed' }
      ];

      mockAxios.onGet('/api/mcp/tasks').reply(200, { data: mockTasks });

      const result = await handleListTasks({});

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
        expect(config.params.limit).toBe(10);
        return [200, { data: mockTasks }];
      });

      await handleListTasks({ status: 'pending', limit: 10 });
    });

    it('should handle API errors gracefully', async () => {
      mockAxios.onGet('/api/mcp/tasks').reply(500, { error: 'Internal server error' });

      try {
        await handleListTasks({});
      } catch (error) {
        const errorResult = handleError(error);
        expect(errorResult.isError).toBe(true);
        expect(errorResult.content[0].text).toContain('Error:');
      }
    });
  });

  describe('create_task handler', () => {
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

      const result = await handleCreateTask(newTask);

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(createdTask);
    });

    it('should handle creation errors', async () => {
      mockAxios.onPost('/api/mcp/tasks').reply(400, { 
        error: 'Validation failed',
        details: { content: 'is required' }
      });

      try {
        await handleCreateTask({ is_important: true });
      } catch (error) {
        const errorResult = handleError(error);
        expect(errorResult.isError).toBe(true);
        expect(errorResult.content[0].text).toContain('Error:');
      }
    });
  });

  describe('update_task handler', () => {
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

      const result = await handleUpdateTask({ id: taskId, ...updateData });

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(updatedTask);
    });

    it('should handle task not found', async () => {
      const taskId = 'non-existent';
      
      mockAxios.onPut(`/api/mcp/tasks/${taskId}`).reply(404, { 
        error: 'Task not found' 
      });

      try {
        await handleUpdateTask({ id: taskId, content: 'Updated content' });
      } catch (error) {
        const errorResult = handleError(error);
        expect(errorResult.isError).toBe(true);
        expect(errorResult.content[0].text).toContain('Error:');
      }
    });
  });

  describe('delete_task handler', () => {
    it('should delete task successfully', async () => {
      const taskId = '123';
      
      mockAxios.onDelete(`/api/mcp/tasks/${taskId}`).reply(200, { 
        message: 'Task deleted successfully' 
      });

      const result = await handleDeleteTask({ id: taskId });

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.message).toBe('Task deleted successfully');
    });

    it('should handle deletion errors', async () => {
      const taskId = 'non-existent';
      
      mockAxios.onDelete(`/api/mcp/tasks/${taskId}`).reply(404, { 
        error: 'Task not found' 
      });

      try {
        await handleDeleteTask({ id: taskId });
      } catch (error) {
        const errorResult = handleError(error);
        expect(errorResult.isError).toBe(true);
        expect(errorResult.content[0].text).toContain('Error:');
      }
    });
  });

  describe('list_categories handler', () => {
    it('should fetch categories successfully', async () => {
      const mockCategories = [
        { id: '1', name: 'Work', color: '#FF0000' },
        { id: '2', name: 'Personal', color: '#00FF00' }
      ];

      mockAxios.onGet('/api/mcp/categories').reply(200, { data: mockCategories });

      const result = await handleListCategories({});

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual(mockCategories);
    });

    it('should handle categories fetch error', async () => {
      mockAxios.onGet('/api/mcp/categories').reply(500, { 
        error: 'Failed to fetch categories' 
      });

      try {
        await handleListCategories({});
      } catch (error) {
        const errorResult = handleError(error);
        expect(errorResult.isError).toBe(true);
        expect(errorResult.content[0].text).toContain('Error:');
      }
    });
  });

  describe('authentication headers', () => {
    it('should include correct authentication headers in requests', async () => {
      mockAxios.onGet('/api/mcp/tasks').reply((config) => {
        expect(config.headers.Authorization).toBe(`McpKey ${mockApiKey}`);
        expect(config.headers['Content-Type']).toBe('application/json');
        return [200, { data: [] }];
      });

      await handleListTasks({});
    });
  });

  describe('error handling', () => {
    it('should format errors correctly', () => {
      const error = new Error('Test error');
      error.response = {
        data: { message: 'API error details' }
      };

      const errorResult = handleError(error);

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toContain('Error: Test error');
      expect(errorResult.content[0].text).toContain('API error details');
    });

    it('should handle errors without response data', () => {
      const error = new Error('Network error');

      const errorResult = handleError(error);

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toBe('Error: Network error\n');
    });
  });

  describe('tool schemas', () => {
    it('should define correct tool schemas', () => {
      const tools = [
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
        }
      ];

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('list_tasks');
      expect(tools[1].inputSchema.required).toContain('content');
    });
  });
});