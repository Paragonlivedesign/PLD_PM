import { Router } from "express";
import { ZodError } from "zod";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import { asyncHandler, requirePermission, } from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import * as repo from "./repository.js";
import { updateVendorSchema } from "./schemas.js";
import { createContactsNestedRouter } from "../contacts/nested-routes.js";
export const vendorsRouter = Router();
vendorsRouter.get("/", requirePermission("vendors:read"), asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const rows = await repo.listVendors(pool, req.ctx.tenantId, limit);
    res.json(ok(rows, { total_count: rows.length }));
}));
vendorsRouter.get("/:id", requirePermission("vendors:read"), asyncHandler(async (req, res) => {
    const row = await repo.getVendorById(pool, req.ctx.tenantId, routeParam(req.params.id));
    if (!row) {
        res.status(404).json(singleError("not_found", "Vendor not found", 404).body);
        return;
    }
    res.json(ok(row));
}));
vendorsRouter.put("/:id", requirePermission("vendors:update"), asyncHandler(async (req, res) => {
    try {
        const body = updateVendorSchema.parse(req.body);
        if (Object.keys(body).length === 0) {
            res.status(400).json(singleError("validation", "No fields to update", 400).body);
            return;
        }
        const existing = await repo.getVendorById(pool, req.ctx.tenantId, routeParam(req.params.id));
        if (!existing) {
            res.status(404).json(singleError("not_found", "Vendor not found", 404).body);
            return;
        }
        if (body.linked_client_id !== undefined) {
            const updated = await repo.updateVendorLinkedClient(pool, req.ctx.tenantId, routeParam(req.params.id), body.linked_client_id);
            if (!updated) {
                res.status(400).json(singleError("not_found", "linked client not found", 400).body);
                return;
            }
            res.json(ok(updated));
            return;
        }
        res.json(ok(existing));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
vendorsRouter.use("/:vendorId/contacts", createContactsNestedRouter({
    parentType: "vendor_organization",
    paramKey: "vendorId",
    readPerm: "vendors:read",
    writePerm: "vendors:update",
}));
