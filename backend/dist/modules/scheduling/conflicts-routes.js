import { Router } from "express";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { asyncHandler, requestContextMiddleware } from "../../core/middleware.js";
import { listConflictsApi } from "./conflicts-list.service.js";
export const conflictsRouter = Router();
conflictsRouter.use(requestContextMiddleware);
conflictsRouter.get("/", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const statusCsv = typeof q.status === "string" ? q.status : undefined;
    const status = statusCsv?.split(",").map((s) => s.trim()).filter(Boolean);
    const severityCsv = typeof q.severity === "string" ? q.severity : undefined;
    const severity = severityCsv?.split(",").map((s) => s.trim()).filter(Boolean);
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const resourceType = q.resource_type === "truck" || q.resource_type === "personnel"
        ? q.resource_type
        : undefined;
    const result = await listConflictsApi({
        tenantId: ctx.tenantId,
        resourceType,
        resourceId: typeof q.resource_id === "string" ? q.resource_id : undefined,
        eventId: typeof q.event_id === "string" ? q.event_id : undefined,
        status: status?.length ? status : undefined,
        severity: severity?.length ? severity : undefined,
        dateRangeStart: typeof q.date_range_start === "string" ? q.date_range_start : undefined,
        dateRangeEnd: typeof q.date_range_end === "string" ? q.date_range_end : undefined,
        limit,
        cursorId: typeof q.cursor === "string" ? q.cursor : null,
    });
    res.status(200).json(ok(result.rows, {
        cursor: result.nextCursor,
        has_more: result.hasMore,
        total_count: result.total,
        ...(result.conflictDetectionDisabled ? { conflict_detection_disabled: true } : {}),
    }));
}));
