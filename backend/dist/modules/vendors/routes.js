import { Router } from "express";
import { ZodError } from "zod";
import { v7 as uuidv7 } from "uuid";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import { asyncHandler, requirePermission, } from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import * as repo from "./repository.js";
import { createVendorSchema, listVendorsQuerySchema, updateVendorSchema, } from "./schemas.js";
import { createContactsNestedRouter } from "../contacts/nested-routes.js";
import { writeAuditLog } from "../audit/service.js";
export const vendorsRouter = Router();
vendorsRouter.get("/", requirePermission("vendors:read"), asyncHandler(async (req, res) => {
    try {
        const q = listVendorsQuerySchema.parse(req.query);
        const limit = Math.min(100, Math.max(1, q.limit ?? 50));
        const rows = await repo.listVendors(pool, req.ctx.tenantId, limit, q.search);
        res.json(ok(rows, { total_count: rows.length }));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
vendorsRouter.post("/", requirePermission("vendors:create"), asyncHandler(async (req, res) => {
    try {
        const body = createVendorSchema.parse(req.body);
        if (body.linked_client_id) {
            const c = await pool.query(`SELECT 1 FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [req.ctx.tenantId, body.linked_client_id]);
            if (c.rowCount === 0) {
                res.status(400).json(singleError("not_found", "linked client not found", 400).body);
                return;
            }
        }
        const id = uuidv7();
        const row = await repo.insertVendor(pool, {
            id,
            tenantId: req.ctx.tenantId,
            name: body.name,
            contact_name: body.contact_name ?? null,
            contact_email: body.contact_email ?? null,
            phone: body.phone ?? null,
            notes: body.notes ?? null,
            metadata: body.metadata ?? {},
            linked_client_id: body.linked_client_id ?? null,
        });
        void writeAuditLog(pool, {
            tenantId: req.ctx.tenantId,
            userId: req.ctx.userId,
            entityType: "vendor",
            entityId: id,
            action: "create",
            changes: { after: { name: body.name } },
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
        const expected = body.updated_at;
        const { updated_at: _omit, ...patch } = body;
        void _omit;
        if (Object.keys(patch).length === 0) {
            res.status(400).json(singleError("validation", "No fields to update", 400).body);
            return;
        }
        const vid = routeParam(req.params.id);
        const existing = await repo.getVendorById(pool, req.ctx.tenantId, vid);
        if (!existing) {
            res.status(404).json(singleError("not_found", "Vendor not found", 404).body);
            return;
        }
        if (patch.linked_client_id !== undefined && patch.linked_client_id !== null) {
            const c = await pool.query(`SELECT 1 FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [req.ctx.tenantId, patch.linked_client_id]);
            if (c.rowCount === 0) {
                res.status(400).json(singleError("not_found", "linked client not found", 400).body);
                return;
            }
        }
        const updated = await repo.updateVendorRow(pool, req.ctx.tenantId, vid, patch, expected);
        if (!updated && expected) {
            res.status(409).json(singleError("conflict", "Conflicting update (stale updated_at)", 409).body);
            return;
        }
        if (!updated) {
            res.status(404).json(singleError("not_found", "Vendor not found", 404).body);
            return;
        }
        void writeAuditLog(pool, {
            tenantId: req.ctx.tenantId,
            userId: req.ctx.userId,
            entityType: "vendor",
            entityId: vid,
            action: "update",
            changes: { patch },
        }).catch(() => undefined);
        res.json(ok(updated));
    }
    catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json(singleError("validation", e.message, 400).body);
            return;
        }
        throw e;
    }
}));
vendorsRouter.delete("/:id", requirePermission("vendors:delete"), asyncHandler(async (req, res) => {
    const vid = routeParam(req.params.id);
    const del = await repo.softDeleteVendor(pool, req.ctx.tenantId, vid);
    if (!del) {
        res.status(404).json(singleError("not_found", "Vendor not found", 404).body);
        return;
    }
    void writeAuditLog(pool, {
        tenantId: req.ctx.tenantId,
        userId: req.ctx.userId,
        entityType: "vendor",
        entityId: vid,
        action: "delete",
        changes: {},
    }).catch(() => undefined);
    res.json(ok(del));
}));
vendorsRouter.use("/:vendorId/contacts", createContactsNestedRouter({
    parentType: "vendor_organization",
    paramKey: "vendorId",
    readPerm: "vendors:read",
    writePerm: "vendors:update",
}));
