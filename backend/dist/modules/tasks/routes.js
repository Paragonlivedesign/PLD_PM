import { Router } from "express";
import { ZodError } from "zod";
import { v7 as uuidv7 } from "uuid";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import { asyncHandler, requirePermission } from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import * as repo from "./repository.js";
import { bulkUpdateTasksSchema, createTaskSchema, listTasksQuerySchema, patchTaskSchema, } from "./schemas.js";
import { writeAuditLog } from "../audit/service.js";
import { getEventById } from "../events/repository.js";
export const tasksRouter = Router();
function encodeCursor(t) {
    return Buffer.from(JSON.stringify({ u: t.updated_at, id: t.id }), "utf8").toString("base64url");
}
function decodeCursor(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        if (j.u && j.id)
            return { u: j.u, id: j.id };
    }
    catch {
        /* ignore */
    }
    return null;
}
async function getPersonnelIdForUser(tenantId, userId) {
    const r = await pool.query(`SELECT personnel_id FROM users WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, userId]);
    return r.rows[0]?.personnel_id ?? null;
}
async function assertPersonnel(tenantId, personnelId) {
    const r = await pool.query(`SELECT 1 FROM personnel WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, personnelId]);
    return (r.rowCount ?? 0) > 0;
}
function parseDate(s) {
    if (s == null || s === "")
        return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}
tasksRouter.post("/", requirePermission("tasks:create"), asyncHandler(async (req, res) => {
    try {
        const body = createTaskSchema.parse(req.body);
        const tenantId = req.ctx.tenantId;
        if (body.event_id) {
            const ev = await getEventById(pool, tenantId, body.event_id);
            if (!ev) {
                res.status(400).json(singleError("validation", "event_id not found", 400).body);
                return;
            }
        }
        if (body.assignee_personnel_id) {
            const okP = await assertPersonnel(tenantId, body.assignee_personnel_id);
            if (!okP) {
                res.status(400).json(singleError("validation", "assignee_personnel_id not found", 400).body);
                return;
            }
        }
        if (body.parent_task_id) {
            const parent = await repo.getTaskById(pool, tenantId, body.parent_task_id);
            if (!parent) {
                res.status(400).json(singleError("validation", "parent_task_id not found", 400).body);
                return;
            }
        }
        const id = uuidv7();
        const row = await repo.insertTask(pool, {
            id,
            tenantId,
            title: body.title,
            description: body.description ?? null,
            status: body.status ?? "open",
            priority: body.priority ?? "normal",
            taskType: body.task_type ?? "task",
            eventId: body.event_id ?? null,
            assigneePersonnelId: body.assignee_personnel_id ?? null,
            parentTaskId: body.parent_task_id ?? null,
            startAt: parseDate(body.start_at ?? undefined),
            dueAt: parseDate(body.due_at ?? undefined),
            completionPercent: body.completion_percent ?? null,
            tags: body.tags ?? [],
            sortOrder: body.sort_order ?? 0,
            metadata: body.metadata ?? {},
            createdBy: req.ctx.userId,
        });
        void writeAuditLog(pool, {
            tenantId,
            userId: req.ctx.userId,
            entityType: "task",
            entityId: id,
            action: "create",
            changes: { after: { title: body.title } },
        }).catch(() => undefined);
        res.status(201).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
tasksRouter.get("/", requirePermission("tasks:read"), asyncHandler(async (req, res) => {
    try {
        const q = listTasksQuerySchema.parse(req.query);
        const limit = q.limit ?? 50;
        const cur = decodeCursor(q.cursor);
        let parentScope = "root";
        if (q.parent_task_id === "any") {
            parentScope = "any";
        }
        else if (q.parent_task_id === "root" || q.parent_task_id === "") {
            parentScope = "root";
        }
        else if (q.parent_task_id && q.parent_task_id.length > 10) {
            parentScope = q.parent_task_id;
        }
        let minePid;
        if (q.mine) {
            minePid = await getPersonnelIdForUser(req.ctx.tenantId, req.ctx.userId);
        }
        const { rows, total } = await repo.listTasks(pool, {
            tenantId: req.ctx.tenantId,
            status: q.status,
            priority: q.priority,
            eventId: q.event_id,
            assigneePersonnelId: q.assignee_personnel_id,
            parentScope,
            dueFrom: q.due_from,
            dueTo: q.due_to,
            search: q.search,
            minePersonnelId: minePid ?? undefined,
            limit,
            cursorUpdatedAt: cur?.u,
            cursorId: cur?.id,
        });
        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]) : null;
        res.status(200).json(ok(slice, {
            cursor: nextCursor,
            has_more: hasMore,
            total_count: total,
        }));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
tasksRouter.post("/bulk-update", requirePermission("tasks:update"), asyncHandler(async (req, res) => {
    try {
        const body = bulkUpdateTasksSchema.parse(req.body);
        const patch = patchTaskSchema.parse(body.patch);
        const tenantId = req.ctx.tenantId;
        if (patch.event_id) {
            const ev = await getEventById(pool, tenantId, patch.event_id);
            if (!ev) {
                res.status(400).json(singleError("validation", "event_id not found", 400).body);
                return;
            }
        }
        if (patch.assignee_personnel_id) {
            const okP = await assertPersonnel(tenantId, patch.assignee_personnel_id);
            if (!okP) {
                res.status(400).json(singleError("validation", "assignee_personnel_id not found", 400).body);
                return;
            }
        }
        const n = await repo.bulkUpdateTasks(pool, tenantId, body.task_ids, {
            title: patch.title,
            description: patch.description,
            status: patch.status,
            priority: patch.priority,
            taskType: patch.task_type,
            eventId: patch.event_id,
            assigneePersonnelId: patch.assignee_personnel_id,
            parentTaskId: patch.parent_task_id,
            startAt: patch.start_at !== undefined ? parseDate(patch.start_at) : undefined,
            dueAt: patch.due_at !== undefined ? parseDate(patch.due_at) : undefined,
            completionPercent: patch.completion_percent,
            tags: patch.tags,
            sortOrder: patch.sort_order,
            metadata: patch.metadata,
        });
        res.status(200).json(ok({ updated_count: n }));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
tasksRouter.get("/:id", requirePermission("tasks:read"), asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const row = await repo.getTaskById(pool, req.ctx.tenantId, id);
    if (!row) {
        res.status(404).json(singleError("not_found", "Task not found", 404).body);
        return;
    }
    res.status(200).json(ok(row));
}));
tasksRouter.patch("/:id", requirePermission("tasks:update"), asyncHandler(async (req, res) => {
    try {
        const id = routeParam(req.params.id);
        const body = patchTaskSchema.parse(req.body);
        const tenantId = req.ctx.tenantId;
        if (body.event_id) {
            const ev = await getEventById(pool, tenantId, body.event_id);
            if (!ev) {
                res.status(400).json(singleError("validation", "event_id not found", 400).body);
                return;
            }
        }
        if (body.assignee_personnel_id) {
            const okP = await assertPersonnel(tenantId, body.assignee_personnel_id);
            if (!okP) {
                res.status(400).json(singleError("validation", "assignee_personnel_id not found", 400).body);
                return;
            }
        }
        if (body.parent_task_id) {
            if (body.parent_task_id === id) {
                res.status(400).json(singleError("validation", "parent_task_id cannot equal id", 400).body);
                return;
            }
            const parent = await repo.getTaskById(pool, tenantId, body.parent_task_id);
            if (!parent) {
                res.status(400).json(singleError("validation", "parent_task_id not found", 400).body);
                return;
            }
        }
        const row = await repo.updateTaskRow(pool, tenantId, id, {
            title: body.title,
            description: body.description,
            status: body.status,
            priority: body.priority,
            taskType: body.task_type,
            eventId: body.event_id,
            assigneePersonnelId: body.assignee_personnel_id,
            parentTaskId: body.parent_task_id,
            startAt: body.start_at !== undefined ? parseDate(body.start_at) : undefined,
            dueAt: body.due_at !== undefined ? parseDate(body.due_at) : undefined,
            completionPercent: body.completion_percent,
            tags: body.tags,
            sortOrder: body.sort_order,
            metadata: body.metadata,
        });
        if (!row) {
            res.status(404).json(singleError("not_found", "Task not found", 404).body);
            return;
        }
        void writeAuditLog(pool, {
            tenantId,
            userId: req.ctx.userId,
            entityType: "task",
            entityId: id,
            action: "update",
            changes: { after: body },
        }).catch(() => undefined);
        res.status(200).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
tasksRouter.delete("/:id", requirePermission("tasks:delete"), asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const okDel = await repo.softDeleteTask(pool, req.ctx.tenantId, id);
    if (!okDel) {
        res.status(404).json(singleError("not_found", "Task not found", 404).body);
        return;
    }
    void writeAuditLog(pool, {
        tenantId: req.ctx.tenantId,
        userId: req.ctx.userId,
        entityType: "task",
        entityId: id,
        action: "delete",
        changes: {},
    }).catch(() => undefined);
    res.status(200).json(ok({ id, deleted_at: new Date().toISOString() }));
}));
