import { Router } from "express";
import { ok } from "../../core/envelope.js";
import { asyncHandler, requestContextMiddleware, requirePermission } from "../../core/middleware.js";
import { pool } from "../../db/pool.js";
import * as svc from "./service.js";

export const auditRouter = Router();
auditRouter.use(requestContextMiddleware);

auditRouter.get(
  "/",
  requirePermission("audit:read"),
  asyncHandler(async (req, res) => {
    const ctx = req.ctx;
    const out = await svc.listAuditLogsApi(pool, ctx.tenantId, req.query as Record<string, string | undefined>);
    res.status(200).json(ok(out.data, out.meta));
  }),
);
