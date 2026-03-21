import { Router } from "express";
import { ZodError } from "zod";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requirePermission } from "../../core/middleware.js";
import { createTravelRecordSchema, listTravelQuerySchema, updateTravelRecordSchema, } from "./schemas.js";
import * as travelSvc from "./service.js";
function paramId(p) {
    return Array.isArray(p) ? String(p[0] ?? "") : String(p ?? "");
}
export const travelRouter = Router();
travelRouter.post("/", requirePermission("travel:create"), asyncHandler(async (req, res) => {
    try {
        const body = createTravelRecordSchema.parse(req.body);
        const ctx = getContext();
        const r = await travelSvc.createTravelRecordApi({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            body: body,
        });
        if (!r.ok) {
            res.status(r.status).json({
                data: null,
                meta: null,
                errors: [{ code: r.code, message: r.message, field: r.field }],
            });
            return;
        }
        res.status(201).json(ok(r.record));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message, undefined);
        }
        throw e;
    }
}));
travelRouter.get("/", asyncHandler(async (req, res) => {
    try {
        const q = listTravelQuerySchema.parse(req.query);
        const ctx = getContext();
        const { rows, total, nextCursor } = await travelSvc.listTravelRecordsApi({
            tenantId: ctx.tenantId,
            query: q,
        });
        res.json({
            data: rows,
            meta: { cursor: nextCursor, has_more: nextCursor != null, total_count: total },
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
travelRouter.get("/:id", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const row = await travelSvc.getTravelRecordApi(ctx.tenantId, paramId(req.params.id));
    if (!row) {
        throw new HttpError(404, "NOT_FOUND", "Travel record not found");
    }
    res.json(ok(row));
}));
travelRouter.put("/:id", requirePermission("travel:update"), asyncHandler(async (req, res) => {
    try {
        const body = updateTravelRecordSchema.parse(req.body);
        const ctx = getContext();
        const r = await travelSvc.updateTravelRecordApi({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            id: paramId(req.params.id),
            body: body,
        });
        if (!r.ok) {
            res.status(r.status).json({
                data: null,
                meta: null,
                errors: [{ code: r.code, message: r.message, field: r.field }],
            });
            return;
        }
        res.json(ok(r.record));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message, undefined);
        }
        throw e;
    }
}));
travelRouter.delete("/:id", requirePermission("travel:delete"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    const r = await travelSvc.deleteTravelRecordApi({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        id: paramId(req.params.id),
    });
    if (!r.ok) {
        res.status(r.status).json({
            data: null,
            meta: null,
            errors: [{ code: r.code, message: r.message }],
        });
        return;
    }
    res.json(ok(r.deleted));
}));
