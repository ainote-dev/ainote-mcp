import { toSuccessContent, enhanceWithStructuredData } from './internal/formatters.js';

function listTasksDefinition() {
  return {
    name: 'list_tasks',
    description: `List tasks from AI Note with natural language support and advanced filtering.

NATURAL LANGUAGE EXAMPLES:
• Location: "여의도에서", "서울에 있는", "강남 관련"
• Time: "오늘", "이번 주", "다음 주", "지난달", "1월에"
• Importance: "중요한", "우선순위 높은", "급한"
• Status: "완료한", "미완료", "안 끝난"
• Special: "마감일 지난", "늦어진", "오늘 마감", "알림 설정된"
• Sort: "마감일 순으로", "최신순으로", "오래된 순으로"

QUERY EXAMPLES:
1. "여의도에서 이번 주 마감인 중요한 미완료 할일"
   → {location: "여의도", due_date_start: "2025-01-27", due_date_end: "2025-02-02",
       is_important: true, status: "pending"}

2. "지난달 완료한 업무 카테고리 할일들을 완료일 순으로"
   → {category_id: "...", status: "completed",
       completed_date_start: "2024-12-01", completed_date_end: "2024-12-31",
       sort_by: "completed_at", sort_order: "asc"}

3. "마감일 지났는데 아직 안 끝난 할일들 마감일 빠른 순으로"
   → {overdue: true, sort_by: "due_date", sort_order: "asc"}

TIME CALCULATIONS (today = 2025-01-27):
• "오늘" → due_today: true
• "이번 주" → due_date_start: "2025-01-27", due_date_end: "2025-02-02"
• "다음 주" → due_date_start: "2025-02-03", due_date_end: "2025-02-09"
• "이번 달" → due_date_start: "2025-01-01", due_date_end: "2025-01-31"
• "지난 주" → completed_date_start: "2025-01-20", completed_date_end: "2025-01-26"
• "지난 달" → completed_date_start: "2024-12-01", completed_date_end: "2024-12-31"

Returns structured data with all task fields including location, dates, and categories.`,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'completed'],
          description: 'Filter by task status'
        },
        is_important: {
          type: 'boolean',
          description: 'Filter by important tasks only'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 25, max: 500)'
        },
        search: {
          type: 'string',
          description: 'Search keyword in task content'
        },
        location: {
          type: 'string',
          description: 'Filter by location (partial match, e.g., "여의도", "서울")'
        },
        category_id: {
          type: 'string',
          description: 'Filter by category UUID'
        },
        due_date_start: {
          type: 'string',
          description: 'Filter tasks with due_date >= this date (ISO 8601 format)'
        },
        due_date_end: {
          type: 'string',
          description: 'Filter tasks with due_date <= this date (ISO 8601 format)'
        },
        completed_date_start: {
          type: 'string',
          description: 'Filter tasks completed >= this date (ISO 8601 format)'
        },
        completed_date_end: {
          type: 'string',
          description: 'Filter tasks completed <= this date (ISO 8601 format)'
        },
        created_date_start: {
          type: 'string',
          description: 'Filter tasks created >= this date (ISO 8601 format)'
        },
        created_date_end: {
          type: 'string',
          description: 'Filter tasks created <= this date (ISO 8601 format)'
        },
        overdue: {
          type: 'boolean',
          description: 'Filter overdue incomplete tasks (due_date < today)'
        },
        due_today: {
          type: 'boolean',
          description: 'Filter tasks due today'
        },
        has_notification: {
          type: 'boolean',
          description: 'Filter by notification enabled status'
        },
        sort_by: {
          type: 'string',
          enum: ['due_date', 'created_at', 'completed_at', 'updated_at', 'is_important'],
          description: 'Sort field (default: created_at)'
        },
        sort_order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default: desc)'
        }
      }
    }
  };
}

// Shared field definitions — keep create and update in sync so MCP exposes
// the same surface for both operations. Server-side strong params
// (Api::McpTasksController#task_params) accepts this full set.
const TASK_FIELD_SCHEMA = {
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
    description: 'Due date in ISO format (e.g., 2026-04-21T15:00:00+09:00)'
  },
  due_time: {
    type: 'string',
    description: 'Time of day in HH:MM (24h). Optional when due_date already carries a time.'
  },
  start_date: {
    type: 'string',
    description: 'Start date for multi-day events (ISO format). For single-day tasks, use due_date.'
  },
  is_all_day: {
    type: 'boolean',
    description: 'Mark as all-day event — suppresses time-of-day rendering.'
  },
  category_id: {
    type: 'string',
    description: 'Category ID. Must be owned by or shared to this user.'
  },
  notes: {
    type: 'string',
    description: 'Free-form notes / details attached to the task.'
  },
  location: {
    type: 'string',
    description: 'Human-readable location (e.g., "Starbucks Gangnam"). For GPS use location_lat/lng.'
  },
  location_lat: {
    type: 'number',
    description: 'GPS latitude. Pair with location_lng.'
  },
  location_lng: {
    type: 'number',
    description: 'GPS longitude. Pair with location_lat.'
  },
  travel_time: {
    type: 'number',
    description: 'Minutes of travel time before due_date to allow for. Used by reminder scheduling.'
  },
  repeat_rule: {
    type: 'string',
    description: 'Recurrence rule. Accepted values depend on server (e.g., "daily", "weekly", "monthly", or RRULE). Creates a recurring series.'
  },
  notification_minutes_before: {
    type: 'number',
    description: 'Schedule a reminder N minutes before due_date. Pass null/omit to clear existing MCP reminder on update. Requires due_date.'
  }
};

function createTaskDefinition() {
  return {
    name: 'create_task',
    description: 'Create a new task in AI Note with optional notification, location, recurrence, and details.',
    inputSchema: {
      type: 'object',
      properties: { ...TASK_FIELD_SCHEMA },
      required: ['content']
    }
  };
}

function updateTaskDefinition() {
  return {
    name: 'update_task',
    description: 'Update an existing task — any subset of fields. Pass notification_minutes_before to reschedule the reminder (or null to clear it).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID'
        },
        completed_at: {
          type: 'string',
          description: 'Mark as completed (ISO format) or null to uncomplete'
        },
        ...TASK_FIELD_SCHEMA
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
        // Enhance result with parsed structured data
        return enhanceWithStructuredData(result);
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
