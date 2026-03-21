import { Router } from "express";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import {
  asyncHandler,
  requestContextMiddleware,
  requireAnyPermission,
} from "../../core/middleware.js";
import * as svc from "./tenancy.service.js";
import { resetTenantOperationalData } from "./tenant-reset.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function paramId(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return String(p[0] ?? "");
  return String(p ?? "");
}

export const tenantRouter = Router();
tenantRouter.use(requestContextMiddleware);

export const departmentsRouter = Router();
departmentsRouter.use(requestContextMiddleware);

tenantRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await svc.getTenantForApi();
    res.status(200).json(ok(data));
  }),
);

tenantRouter.put(
  "/",
  requireAnyPermission("tenancy.settings.edit"),
  asyncHandler(async (req, res) => {
    const data = await svc.updateTenantForApi(req.body as Record<string, unknown>);
    res.status(200).json(ok(data));
  }),
);

/** Irreversibly deletes operational data for the current tenant (users and roles kept). */
tenantRouter.post(
  "/reset-data",
  requireAnyPermission("tenancy.settings.edit"),
  asyncHandler(async (req, res) => {
    const body = req.body as { confirm?: unknown };
    if (String(body?.confirm ?? "") !== "RESET") {
      throw new HttpError(400, "VALIDATION", 'Request body must include "confirm": "RESET"', "confirm");
    }
    const ctx = getContext();
    const out = await resetTenantOperationalData(ctx.tenantId);
    res.status(200).json(ok({ reset: true, tenant_id: ctx.tenantId, deleted_steps: out.deleted_tables }));
  }),
);

departmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const out = await svc.listDepartmentsApi(req.query as Record<string, string | undefined>);
    res.status(200).json(ok(out.data, { total_count: out.total_count }));
  }),
);

departmentsRouter.post(
  "/",
  requireAnyPermission("tenancy.departments.create", "departments:create"),
  asyncHandler(async (req, res) => {
    const data = await svc.createDepartmentApi(req.body as Record<string, unknown>);
    res.status(201).json(ok(data));
  }),
);

departmentsRouter.patch(
  "/reorder",
  requireAnyPermission("tenancy.departments.edit", "departments:update"),
  asyncHandler(async (req, res) => {
    const body = req.body as { ordered_ids?: unknown };
    const ordered = Array.isArray(body.ordered_ids)
      ? body.ordered_ids.map((x) => String(x))
      : [];
    await svc.reorderDepartmentsApi(ordered);
    res.status(200).json(ok({ ok: true }));
  }),
);

departmentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({
        data: null,
        meta: null,
        errors: [{ code: "VALIDATION", message: "Invalid id", field: "id" }],
      });
      return;
    }
    const data = await svc.getDepartmentApi(id);
    res.status(200).json(ok(data));
  }),
);

departmentsRouter.put(
  "/:id",
  requireAnyPermission("tenancy.departments.edit", "departments:update"),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({
        data: null,
        meta: null,
        errors: [{ code: "VALIDATION", message: "Invalid id", field: "id" }],
      });
      return;
    }
    const data = await svc.updateDepartmentApi(id, req.body as Record<string, unknown>);
    res.status(200).json(ok(data));
  }),
);

departmentsRouter.delete(
  "/:id",
  requireAnyPermission("tenancy.departments.delete", "departments:delete"),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({
        data: null,
        meta: null,
        errors: [{ code: "VALIDATION", message: "Invalid id", field: "id" }],
      });
      return;
    }
    const data = await svc.deleteDepartmentApi(id);
    res.status(200).json(ok(data));
  }),
);
