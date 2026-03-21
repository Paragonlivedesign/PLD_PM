import { Router } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler } from "../../core/middleware.js";
import { getContext } from "../../core/context.js";
import * as svc from "./notifications.service.js";
const listQuery = z.object({
    status: z.enum(["unread", "read", "all"]).optional().default("all"),
    type: z.string().optional(),
    sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
const prefsBody = z.object({
    preferences: z.array(z.object({
        notification_type: z.string(),
        channel: z.enum(["in_app", "email", "slack"]),
        enabled: z.boolean(),
    })),
});
export function notificationsRouter(pool) {
    const r = Router();
    r.get("/", asyncHandler(async (req, res) => {
        try {
            const q = listQuery.parse(req.query);
            const ctx = getContext();
            const { rows, nextCursor, total_count, unread_count } = await svc.listNotifications(pool, {
                tenantId: ctx.tenantId,
                userId: ctx.userId,
                status: q.status,
                type: q.type,
                sort_order: q.sort_order,
                cursor: q.cursor,
                limit: q.limit,
            });
            res.json({
                data: rows,
                meta: {
                    cursor: nextCursor,
                    has_more: nextCursor != null,
                    total_count,
                    unread_count,
                },
                errors: null,
            });
        }
        catch (e) {
            if (e instanceof ZodError) {
                throw new HttpError(400, "VALIDATION", e.message, undefined);
            }
            throw e;
        }
    }));
    r.put("/read-all", asyncHandler(async (req, res) => {
        const ctx = getContext();
        const marked = await svc.markAllRead(pool, ctx.tenantId, ctx.userId);
        res.json(ok({ marked_count: marked }));
    }));
    r.put("/:id/read", asyncHandler(async (req, res) => {
        const ctx = getContext();
        const id = String(req.params.id ?? "");
        const row = await svc.markNotificationRead(pool, ctx.tenantId, ctx.userId, id);
        if (!row) {
            res.status(404).json({
                data: null,
                meta: null,
                errors: [{ code: "NOT_FOUND", message: "Notification not found" }],
            });
            return;
        }
        res.json(ok(row));
    }));
    r.get("/preferences", asyncHandler(async (_req, res) => {
        const ctx = getContext();
        const prefs = await svc.getPreferences(pool, ctx.tenantId, ctx.userId);
        res.json(ok(prefs));
    }));
    r.put("/preferences", asyncHandler(async (req, res) => {
        try {
            const body = prefsBody.parse(req.body);
            const ctx = getContext();
            await svc.updatePreferences(pool, ctx.tenantId, ctx.userId, body.preferences);
            const prefs = await svc.getPreferences(pool, ctx.tenantId, ctx.userId);
            res.json(ok(prefs));
        }
        catch (e) {
            if (e instanceof ZodError) {
                throw new HttpError(400, "VALIDATION", e.message, undefined);
            }
            throw e;
        }
    }));
    return r;
}
