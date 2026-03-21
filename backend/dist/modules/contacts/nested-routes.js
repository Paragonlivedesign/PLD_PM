import { Router } from "express";
import { ZodError } from "zod";
import { v7 as uuidv7 } from "uuid";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import { asyncHandler, requirePermission, } from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import * as contactsRepo from "./repository.js";
import { insertContactPerson } from "./person-repository.js";
import * as clientsRepo from "../clients/repository.js";
import * as venuesRepo from "../venues/repository.js";
import * as vendorsRepo from "../vendors/repository.js";
import { getPersonnelById } from "../personnel/personnel.service.js";
import { createContactBodySchema, updateContactBodySchema, } from "./schemas.js";
import { enrichContactWithPersonnel, } from "./enrich-personnel.js";
async function assertParent(tenantId, parentType, parentId) {
    if (parentType === "client_organization") {
        const row = await clientsRepo.getClientById(pool, tenantId, parentId);
        if (!row)
            return { ok: false, status: 404, message: "Client not found" };
        return { ok: true };
    }
    if (parentType === "vendor_organization") {
        const row = await vendorsRepo.getVendorById(pool, tenantId, parentId);
        if (!row)
            return { ok: false, status: 404, message: "Vendor not found" };
        return { ok: true };
    }
    const row = await venuesRepo.getVenueById(pool, tenantId, parentId);
    if (!row)
        return { ok: false, status: 404, message: "Venue not found" };
    return { ok: true };
}
export function createContactsNestedRouter(config) {
    const r = Router({ mergeParams: true });
    r.get("/", requirePermission(config.readPerm), asyncHandler(async (req, res) => {
        const parentId = routeParam(req.params[config.paramKey]);
        const chk = await assertParent(req.ctx.tenantId, config.parentType, parentId);
        if (!chk.ok) {
            res.status(chk.status).json(singleError("not_found", chk.message, chk.status).body);
            return;
        }
        const rows = await contactsRepo.listContactsForParent(pool, req.ctx.tenantId, config.parentType, parentId);
        res.json(ok(rows));
    }));
    r.post("/", requirePermission(config.writePerm), asyncHandler(async (req, res) => {
        const parentId = routeParam(req.params[config.paramKey]);
        const chk = await assertParent(req.ctx.tenantId, config.parentType, parentId);
        if (!chk.ok) {
            res.status(chk.status).json(singleError("not_found", chk.message, chk.status).body);
            return;
        }
        try {
            const body = createContactBodySchema.parse(req.body);
            if (body.personnel_id) {
                const p = await getPersonnelById(body.personnel_id, req.ctx.tenantId);
                if (!p) {
                    res.status(400).json(singleError("not_found", "personnel not found", 400).body);
                    return;
                }
            }
            const contactId = uuidv7();
            const personId = uuidv7();
            const dbClient = await pool.connect();
            try {
                await dbClient.query("BEGIN");
                await insertContactPerson(dbClient, {
                    id: personId,
                    tenantId: req.ctx.tenantId,
                    displayName: body.name,
                    email: body.email ?? null,
                    phone: body.phone ?? null,
                    personnelId: body.personnel_id ?? null,
                    metadata: {},
                });
                const row = await contactsRepo.insertContact(dbClient, {
                    id: contactId,
                    tenantId: req.ctx.tenantId,
                    parentType: config.parentType,
                    parentId,
                    personId,
                    personnelId: body.personnel_id ?? null,
                    name: body.name,
                    email: body.email ?? null,
                    phone: body.phone ?? null,
                    title: body.title ?? null,
                    isPrimary: body.is_primary ?? false,
                    metadata: body.metadata ?? {},
                });
                await dbClient.query("COMMIT");
                res.status(201).json(ok(await enrichContactWithPersonnel(req.ctx.tenantId, row)));
            }
            catch (e) {
                try {
                    await dbClient.query("ROLLBACK");
                }
                catch {
                    /* ignore */
                }
                throw e;
            }
            finally {
                dbClient.release();
            }
        }
        catch (e) {
            if (e instanceof ZodError) {
                res.status(400).json(singleError("validation", e.message, 400).body);
                return;
            }
            throw e;
        }
    }));
    r.get("/:contactId", requirePermission(config.readPerm), asyncHandler(async (req, res) => {
        const parentId = routeParam(req.params[config.paramKey]);
        const chk = await assertParent(req.ctx.tenantId, config.parentType, parentId);
        if (!chk.ok) {
            res.status(chk.status).json(singleError("not_found", chk.message, chk.status).body);
            return;
        }
        const row = await contactsRepo.getContactById(pool, req.ctx.tenantId, routeParam(req.params.contactId));
        if (!row || row.parent_id !== parentId || row.parent_type !== config.parentType) {
            res.status(404).json(singleError("not_found", "Contact not found", 404).body);
            return;
        }
        res.json(ok(await enrichContactWithPersonnel(req.ctx.tenantId, row)));
    }));
    r.put("/:contactId", requirePermission(config.writePerm), asyncHandler(async (req, res) => {
        const parentId = routeParam(req.params[config.paramKey]);
        const chk = await assertParent(req.ctx.tenantId, config.parentType, parentId);
        if (!chk.ok) {
            res.status(chk.status).json(singleError("not_found", chk.message, chk.status).body);
            return;
        }
        const existing = await contactsRepo.getContactById(pool, req.ctx.tenantId, routeParam(req.params.contactId));
        if (!existing || existing.parent_id !== parentId || existing.parent_type !== config.parentType) {
            res.status(404).json(singleError("not_found", "Contact not found", 404).body);
            return;
        }
        try {
            const body = updateContactBodySchema.parse(req.body);
            if (body.personnel_id !== undefined && body.personnel_id !== null) {
                const p = await getPersonnelById(body.personnel_id, req.ctx.tenantId);
                if (!p) {
                    res.status(400).json(singleError("not_found", "personnel not found", 400).body);
                    return;
                }
            }
            const updated = await contactsRepo.updateContactRow(pool, req.ctx.tenantId, routeParam(req.params.contactId), {
                name: body.name,
                email: body.email,
                phone: body.phone,
                title: body.title,
                personnel_id: body.personnel_id,
                is_primary: body.is_primary,
                metadata: body.metadata,
            }, config.parentType, parentId);
            if (!updated) {
                res.status(404).json(singleError("not_found", "Contact not found", 404).body);
                return;
            }
            res.json(ok(await enrichContactWithPersonnel(req.ctx.tenantId, updated)));
        }
        catch (e) {
            if (e instanceof ZodError) {
                res.status(400).json(singleError("validation", e.message, 400).body);
                return;
            }
            throw e;
        }
    }));
    r.delete("/:contactId", requirePermission(config.writePerm), asyncHandler(async (req, res) => {
        const parentId = routeParam(req.params[config.paramKey]);
        const chk = await assertParent(req.ctx.tenantId, config.parentType, parentId);
        if (!chk.ok) {
            res.status(chk.status).json(singleError("not_found", chk.message, chk.status).body);
            return;
        }
        const del = await contactsRepo.softDeleteContact(pool, req.ctx.tenantId, routeParam(req.params.contactId), config.parentType, parentId);
        if (!del) {
            res.status(404).json(singleError("not_found", "Contact not found", 404).body);
            return;
        }
        res.json(ok(del));
    }));
    return r;
}
