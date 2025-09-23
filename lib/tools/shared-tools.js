import { toSuccessContent } from './internal/formatters.js';

function listTasksDefinition() {
  return {
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
  };
}

function createTaskDefinition() {
  return {
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
  };
}

function updateTaskDefinition() {
  return {
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
  };
}

function deleteTaskDefinition() {
  return {
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
  };
}

function listCategoriesDefinition() {
  return {
    name: 'list_categories',
    description: 'List all categories',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  };
}

export function getSharedTools() {
  return [
    {
      definition: listTasksDefinition(),
      handler: async (args, { apiClient }) => {
        const response = await apiClient.get('/api/mcp/tasks', { params: args });
        return toSuccessContent(response.data);
      }
    },
    {
      definition: createTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const response = await apiClient.post('/api/mcp/tasks', { task: args });
        return toSuccessContent(response.data);
      }
    },
    {
      definition: updateTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const { id, ...updateData } = args;
        const response = await apiClient.put(`/api/mcp/tasks/${id}`, { task: updateData });
        return toSuccessContent(response.data);
      }
    },
    {
      definition: deleteTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const response = await apiClient.delete(`/api/mcp/tasks/${args.id}`);
        return toSuccessContent(response.data);
      }
    },
    {
      definition: listCategoriesDefinition(),
      handler: async (_args, { apiClient }) => {
        const response = await apiClient.get('/api/mcp/categories');
        return toSuccessContent(response.data);
      }
    }
  ];
}
