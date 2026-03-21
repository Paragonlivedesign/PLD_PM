import { Router } from "express";
import { ZodError } from "zod";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requestContextMiddleware, requirePermission } from "../../core/middleware.js";
import { personnelTravelQuerySchema } from "../travel/schemas.js";
import * as travelSvc from "../travel/service.js";
import * as importSvc from "./personnel.import.service.js";
import * as svc from "./personnel.service.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertUuid(id, field = "id") {
    if (!UUID_RE.test(id)) {
        throw new HttpError(400, "VALIDATION", `Invalid ${field}`, field);
    }
}
function paramId(p) {
    if (Array.isArray(p))
        return String(p[0] ?? "");
    return String(p ?? "");
}
export const personnelRouter = Router();
personnelRouter.use(requestContextMiddleware);
personnelRouter.get("/", asyncHandler(async (req, res) => {
    const out = await svc.listPersonnel(req.query, req);
    res.status(200).json(ok(out.data, out.meta));
}));
personnelRouter.post("/", requirePermission("personnel:create"), asyncHandler(async (req, res) => {
    const data = await svc.createPersonnel(req.body, req);
    res.status(201).json(ok(data));
}));
personnelRouter.get("/availability", asyncHandler(async (req, res) => {
    const out = await svc.listBulkAvailability(req.query);
    res.status(200).json(ok(out.data, out.meta));
}));
personnelRouter.post("/import/upload", requirePermission("personnel:create"), asyncHandler(async (req, res) => {
    const data = await importSvc.personnelImportUpload(req.body);
    res.status(200).json(ok(data));
}));
personnelRouter.post("/import/validate", requirePermission("personnel:create"), asyncHandler(async (req, res) => {
    const data = await importSvc.personnelImportValidate(req.body);
    res.status(200).json(ok(data));
}));
personnelRouter.post("/import/preview", requirePermission("personnel:create"), asyncHandler(async (req, res) => {
    const data = await importSvc.personnelImportPreview(req.body);
    res.status(200).json(ok(data));
}));
personnelRouter.post("/import/confirm", requirePermission("personnel:create"), asyncHandler(async (req, res) => {
    const data = await importSvc.personnelImportConfirm(req.body);
    res.status(200).json(ok(data));
}));
personnelRouter.get("/:id/availability", asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const start = String(req.query.start ?? "");
    const end = String(req.query.end ?? "");
    if (!start || !end) {
        throw new HttpError(400, "VALIDATION", "start and end are required", "start");
    }
    const data = await svc.getAvailability(id, start, end);
    res.status(200).json(ok(data));
}));
personnelRouter.get("/:id/travel", asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    let q;
    try {
        q = personnelTravelQuerySchema.parse(req.query);
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message, undefined);
        }
        throw e;
    }
    const ctx = getContext();
    const r = await travelSvc.getPersonnelTravelListApi({
        tenantId: ctx.tenantId,
        personnelId: id,
        query: q,
    });
    if (!r.ok) {
        res.status(r.status).json({
            data: null,
            meta: null,
            errors: [{ code: r.code, message: r.message }],
        });
        return;
    }
    res.status(200).json({
        data: r.rows,
        meta: {
            cursor: r.nextCursor,
            has_more: r.nextCursor != null,
            total_count: r.total,
            total_cost: r.total_cost,
            currency: r.currency,
        },
        errors: null,
    });
}));
personnelRouter.get("/:id", asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.getPersonnel(id, req);
    res.status(200).json(ok(data));
}));
personnelRouter.put("/:id", requirePermission("personnel:update"), asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.updatePersonnel(id, req.body, req);
    res.status(200).json(ok(data));
}));
personnelRouter.delete("/:id", requirePermission("personnel:delete"), asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.deletePersonnel(id);
    res.status(200).json(ok(data));
}));
export const invitationsRouter = Router();
invitationsRouter.use(requestContextMiddleware);
invitationsRouter.get("/", asyncHandler(async (req, res) => {
    const out = await svc.listInvitations(req.query);
    res.status(200).json(ok(out.data, out.meta));
}));
invitationsRouter.post("/", requirePermission("personnel:invite"), asyncHandler(async (req, res) => {
    const data = await svc.createInvitation(req.body);
    res.status(201).json(ok(data));
}));
invitationsRouter.delete("/:id", requirePermission("personnel:invite"), asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.revokeInvitation(id);
    res.status(200).json(ok(data));
}));
