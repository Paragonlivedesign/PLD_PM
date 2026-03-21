import type { Pool, PoolClient } from "pg";
import type { TaskResponse } from "@pld/shared";

type Row = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  event_id: string | null;
  assignee_personnel_id: string | null;
  parent_task_id: string | null;
  start_at: Date | null;
  due_at: Date | null;
  completion_percent: number | null;
  tags: unknown;
  sort_order: number;
  metadata: unknown;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === "string");
  }
  return [];
}

export function mapTaskRow(r: Row): TaskResponse {
  const metadata =
    r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {};
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as TaskResponse["status"],
    priority: r.priority as TaskResponse["priority"],
    task_type: r.task_type as TaskResponse["task_type"],
    event_id: r.event_id,
    assignee_personnel_id: r.assignee_personnel_id,
    parent_task_id: r.parent_task_id,
    start_at: r.start_at ? r.start_at.toISOString() : null,
    due_at: r.due_at ? r.due_at.toISOString() : null,
    completion_percent: r.completion_percent,
    tags: parseTags(r.tags),
    sort_order: r.sort_order,
    metadata,
    created_by: r.created_by,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
  };
}

export async function getTaskById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<TaskResponse | null> {
  const r = await client.query<Row>(
    `SELECT * FROM tasks WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ? mapTaskRow(r.rows[0]) : null;
}

export type ListTasksParams = {
  tenantId: string;
  status?: string;
  priority?: string;
  eventId?: string;
  assigneePersonnelId?: string;
  /** null = only root tasks (no parent); uuid = children of parent */
  parentScope: "any" | "root" | string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  minePersonnelId?: string | null;
  limit: number;
  cursorUpdatedAt?: string;
  cursorId?: string;
};

export async function listTasks(
  client: Pool | PoolClient,
  p: ListTasksParams,
): Promise<{ rows: TaskResponse[]; total: number }> {
  const cond: string[] = ["t.tenant_id = $1", "t.deleted_at IS NULL"];
  const args: unknown[] = [p.tenantId];
  let n = 2;

  if (p.status) {
    cond.push(`t.status = $${n}`);
    args.push(p.status);
    n += 1;
  }
  if (p.priority) {
    cond.push(`t.priority = $${n}`);
    args.push(p.priority);
    n += 1;
  }
  if (p.eventId) {
    cond.push(`t.event_id = $${n}`);
    args.push(p.eventId);
    n += 1;
  }
  if (p.assigneePersonnelId) {
    cond.push(`t.assignee_personnel_id = $${n}`);
    args.push(p.assigneePersonnelId);
    n += 1;
  }
  if (p.parentScope === "root") {
    cond.push(`t.parent_task_id IS NULL`);
  } else if (p.parentScope !== "any") {
    cond.push(`t.parent_task_id = $${n}`);
    args.push(p.parentScope);
    n += 1;
  }
  if (p.dueFrom) {
    cond.push(`t.due_at >= $${n}`);
    args.push(p.dueFrom);
    n += 1;
  }
  if (p.dueTo) {
    cond.push(`t.due_at <= $${n}`);
    args.push(p.dueTo);
    n += 1;
  }
  if (p.minePersonnelId) {
    cond.push(`t.assignee_personnel_id = $${n}`);
    args.push(p.minePersonnelId);
    n += 1;
  }
  if (p.search?.trim()) {
    const term = `%${p.search.trim().replace(/%/g, "\\%")}%`;
    cond.push(
      `(t.title ILIKE $${n} ESCAPE '\\' OR COALESCE(t.description,'') ILIKE $${n} ESCAPE '\\')`,
    );
    args.push(term);
    n += 1;
  }

  const whereSql = cond.join(" AND ");

  const countR = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM tasks t WHERE ${whereSql}`,
    args,
  );
  const total = Number(countR.rows[0]?.c ?? 0);

  let cursorCond = "";
  if (p.cursorUpdatedAt && p.cursorId) {
    const i1 = n;
    const i2 = n + 1;
    cursorCond = ` AND (t.updated_at < $${i1}::timestamptz OR (t.updated_at = $${i1}::timestamptz AND t.id < $${i2}))`;
    args.push(p.cursorUpdatedAt, p.cursorId);
    n += 2;
  }

  const lim = p.limit;
  const limitPlaceholder = n;
  args.push(lim + 1);

  const q = `
    SELECT t.* FROM tasks t
    WHERE ${whereSql}${cursorCond}
    ORDER BY t.updated_at DESC, t.id DESC
    LIMIT $${limitPlaceholder}
  `;
  const r = await client.query<Row>(q, args);
  return { rows: r.rows.map(mapTaskRow), total };
}

export async function insertTask(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    taskType: string;
    eventId: string | null;
    assigneePersonnelId: string | null;
    parentTaskId: string | null;
    startAt: Date | null;
    dueAt: Date | null;
    completionPercent: number | null;
    tags: string[];
    sortOrder: number;
    metadata: Record<string, unknown>;
    createdBy: string | null;
  },
): Promise<TaskResponse> {
  const r = await client.query<Row>(
    `INSERT INTO tasks (
      id, tenant_id, title, description, status, priority, task_type,
      event_id, assignee_personnel_id, parent_task_id,
      start_at, due_at, completion_percent, tags, sort_order, metadata, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,
      $11,$12,$13,$14::jsonb,$15,$16::jsonb,$17
    ) RETURNING *`,
    [
      p.id,
      p.tenantId,
      p.title,
      p.description,
      p.status,
      p.priority,
      p.taskType,
      p.eventId,
      p.assigneePersonnelId,
      p.parentTaskId,
      p.startAt,
      p.dueAt,
      p.completionPercent,
      JSON.stringify(p.tags),
      p.sortOrder,
      JSON.stringify(p.metadata),
      p.createdBy,
    ],
  );
  return mapTaskRow(r.rows[0]);
}

export async function updateTaskRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    taskType?: string;
    eventId?: string | null;
    assigneePersonnelId?: string | null;
    parentTaskId?: string | null;
    startAt?: Date | null;
    dueAt?: Date | null;
    completionPercent?: number | null;
    tags?: string[];
    sortOrder?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<TaskResponse | null> {
  const cur = await client.query<Row>(
    `SELECT * FROM tasks WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  if (!cur.rows[0]) return null;
  const row = cur.rows[0];
  const title = patch.title ?? row.title;
  const description = patch.description !== undefined ? patch.description : row.description;
  const status = patch.status ?? row.status;
  const priority = patch.priority ?? row.priority;
  const taskType = patch.taskType ?? row.task_type;
  const eventId = patch.eventId !== undefined ? patch.eventId : row.event_id;
  const assigneePersonnelId =
    patch.assigneePersonnelId !== undefined ? patch.assigneePersonnelId : row.assignee_personnel_id;
  const parentTaskId = patch.parentTaskId !== undefined ? patch.parentTaskId : row.parent_task_id;
  const startAt =
    patch.startAt !== undefined
      ? patch.startAt
      : row.start_at;
  const dueAt = patch.dueAt !== undefined ? patch.dueAt : row.due_at;
  const completionPercent =
    patch.completionPercent !== undefined ? patch.completionPercent : row.completion_percent;
  const tags = patch.tags ?? parseTags(row.tags);
  const sortOrder = patch.sortOrder ?? row.sort_order;
  const metadata =
    patch.metadata !== undefined
      ? patch.metadata
      : (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {});

  const r = await client.query<Row>(
    `UPDATE tasks SET
      title = $3,
      description = $4,
      status = $5,
      priority = $6,
      task_type = $7,
      event_id = $8,
      assignee_personnel_id = $9,
      parent_task_id = $10,
      start_at = $11,
      due_at = $12,
      completion_percent = $13,
      tags = $14::jsonb,
      sort_order = $15,
      metadata = $16::jsonb,
      updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
    RETURNING *`,
    [
      tenantId,
      id,
      title,
      description,
      status,
      priority,
      taskType,
      eventId,
      assigneePersonnelId,
      parentTaskId,
      startAt,
      dueAt,
      completionPercent,
      JSON.stringify(tags),
      sortOrder,
      JSON.stringify(metadata),
    ],
  );
  return r.rows[0] ? mapTaskRow(r.rows[0]) : null;
}

export async function softDeleteTask(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<boolean> {
  const r = await client.query(
    `UPDATE tasks SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function bulkUpdateTasks(
  client: Pool | PoolClient,
  tenantId: string,
  taskIds: string[],
  patch: Parameters<typeof updateTaskRow>[3],
): Promise<number> {
  let n = 0;
  for (const id of taskIds) {
    const row = await updateTaskRow(client, tenantId, id, patch);
    if (row) n += 1;
  }
  return n;
}
