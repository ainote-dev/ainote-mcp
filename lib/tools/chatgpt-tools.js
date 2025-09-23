import { toSuccessContent } from './internal/formatters.js';

const MAX_RESULTS = 20;

function searchDefinition() {
  return {
    name: 'search',
    description: 'Search tasks and categories in AI Note',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for tasks content, categories, or due dates'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of search results (default: 20)'
        }
      },
      required: ['query']
    }
  };
}

function fetchDefinition() {
  return {
    name: 'fetch',
    description: 'Fetch detailed information about a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID to fetch detailed information'
        }
      },
      required: ['id']
    }
  };
}

export function getChatGptTools() {
  return [
    {
      definition: searchDefinition(),
      handler: async (args, { apiClient }) => {
        const limit = typeof args.limit === 'number' ? Math.min(args.limit, MAX_RESULTS) : MAX_RESULTS;
        const response = await apiClient.get('/api/mcp/tasks', {
          params: {
            search: args.query,
            limit
          }
        });

        const results = Array.isArray(response.data?.tasks)
          ? response.data.tasks.map((task) => ({
              id: task.id,
              title: task.content,
              due_date: task.due_date,
              is_important: task.is_important,
              url: task.url ?? `https://app.ainote.dev/tasks/${task.id}`,
              category: task.category
            }))
          : response.data;

        return toSuccessContent({
          results,
          meta: {
            source: 'ai-note',
            query: args.query,
            limit
          }
        });
      }
    },
    {
      definition: fetchDefinition(),
      handler: async (args, { apiClient }) => {
        const response = await apiClient.get(`/api/mcp/tasks/${args.id}`);
        const task = response.data?.task ?? response.data;

        return toSuccessContent({
          task,
          meta: {
            source: 'ai-note',
            fetched_at: new Date().toISOString()
          }
        });
      }
    }
  ];
}
