import { Router } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requireAnyPermission } from "../../core/middleware.js";
import { getContext } from "../../core/context.js";
import * as analyticsSvc from "./service.js";
const dashQuery = z.object({
    date_range_start: z.string().optional(),
    date_range_end: z.string().optional(),
    department_id: z.string().uuid().optional(),
    event_status: z.string().optional(),
});
const financialQuery = z.object({
    date_range_start: z.string().optional(),
    date_range_end: z.string().optional(),
    client_id: z.string().uuid().optional(),
    event_id: z.string().uuid().optional(),
});
export function analyticsDashboardRouter(pool) {
    const r = Router();
    r.get("/operations", requireAnyPermission("analytics:dashboard:read", "events:read"), asyncHandler(async (req, res) => {
        try {
            const q = dashQuery.parse(req.query);
            const ctx = getContext();
            const { data, meta } = await analyticsSvc.getOperationsDashboard(pool, ctx.tenantId, q);
            res.json(ok(data, meta));
        }
        catch (e) {
            if (e instanceof ZodError) {
                throw new HttpError(400, "VALIDATION", e.message, undefined);
            }
            throw e;
        }
    }));
    r.get("/financial", requireAnyPermission("analytics:dashboard:read", "events:read"), requireAnyPermission("reports:read", "events:read"), asyncHandler(async (req, res) => {
        try {
            const q = financialQuery.parse(req.query);
            const ctx = getContext();
            const { data, meta } = await analyticsSvc.getFinancialDashboard(pool, ctx.tenantId, q);
            res.json(ok(data, meta));
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
