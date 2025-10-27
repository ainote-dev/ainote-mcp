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
        const result = await apiClient.callTool('list_tasks', args);
        return result;  // Return full result with { content: [...] }
      }
    },
    {
      definition: createTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('create_task', args);
        return result;  // Return full result with { content: [...] }
      }
    },
    {
      definition: updateTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('update_task', args);
        return result;  // Return full result with { content: [...] }
      }
    },
    {
      definition: deleteTaskDefinition(),
      handler: async (args, { apiClient }) => {
        const result = await apiClient.callTool('delete_task', args);
        return result;  // Return full result with { content: [...] }
      }
    },
    {
      definition: listCategoriesDefinition(),
      handler: async (_args, { apiClient }) => {
        const result = await apiClient.callTool('list_categories', {});
        return result;  // Return full result with { content: [...] }
      }
    }
  ];
}
