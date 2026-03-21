import { Router } from "express";
import { ok } from "../../core/envelope.js";
import { asyncHandler } from "../../core/middleware.js";
import { pool } from "../../db/pool.js";
import * as repo from "./platform.repository.js";
import { platformAdminMiddleware } from "./platform.middleware.js";
export const platformRouter = Router();
platformRouter.use(platformAdminMiddleware);
/** GET /api/v1/platform/tenants — all tenants with condensed user lists */
platformRouter.get("/tenants", asyncHandler(async (_req, res) => {
    const rows = await repo.listAllTenantsWithUsers(pool);
    res.status(200).json(ok(rows));
}));
