import { z } from "zod";

const statusZ = z.enum(["open", "in_progress", "blocked", "done", "cancelled"]);
const priorityZ = z.enum(["low", "normal", "high", "urgent"]);
const typeZ = z.enum(["task", "milestone", "checklist"]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20000).optional().nullable(),
  status: statusZ.optional(),
  priority: priorityZ.optional(),
  task_type: typeZ.optional(),
  event_id: z.string().uuid().optional().nullable(),
  assignee_personnel_id: z.string().uuid().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  completion_percent: z.number().int().min(0).max(100).optional().nullable(),
  tags: z.array(z.string().max(128)).max(50).optional(),
  sort_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const patchTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional().nullable(),
  status: statusZ.optional(),
  priority: priorityZ.optional(),
  task_type: typeZ.optional(),
  event_id: z.string().uuid().optional().nullable(),
  assignee_personnel_id: z.string().uuid().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  completion_percent: z.number().int().min(0).max(100).optional().nullable(),
  tags: z.array(z.string().max(128)).max(50).optional(),
  sort_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  updated_at: z.string().datetime().optional(),
});

export const listTasksQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  event_id: z.string().uuid().optional(),
  assignee_personnel_id: z.string().uuid().optional(),
  parent_task_id: z
    .union([z.literal(""), z.literal("root"), z.literal("any"), z.string().uuid()])
    .optional(),
  due_from: z.string().datetime().optional(),
  due_to: z.string().datetime().optional(),
  search: z.string().max(500).optional(),
  mine: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const bulkUpdateTasksSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(200),
  patch: patchTaskSchema,
});
