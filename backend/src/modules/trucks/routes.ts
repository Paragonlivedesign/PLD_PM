import { Router } from "express";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import {
  asyncHandler,
  requestContextMiddleware,
  requirePermission,
} from "../../core/middleware.js";
import {
  createTruck,
  createTruckRouteApi,
  createAssignmentViaTruck,
  getTruck,
  getTruckAvailability,
  getTruckRoutesForEvent,
  listAssignmentsForTruck,
  listTrucksApi,
  retireTruckApi,
  updateTruck,
  updateTruckRouteApi,
} from "./trucks.service.js";

export const trucksRouter = Router();
trucksRouter.use(requestContextMiddleware);

trucksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const type =
      typeof q.type === "string"
        ? q.type.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const status =
      typeof q.status === "string"
        ? q.status.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const sortByRaw = (q.sort_by as string) || "name";
    const sort_by =
      sortByRaw === "name" ||
      sortByRaw === "type" ||
      sortByRaw === "status" ||
      sortByRaw === "capacity_cubic_ft" ||
      sortByRaw === "created_at"
        ? sortByRaw
        : "name";
    const sort_order = q.sort_order === "desc" ? "desc" : "asc";
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const result = await listTrucksApi({
      tenantId: ctx.tenantId,
      type,
      status,
      home_base: typeof q.home_base === "string" ? q.home_base : undefined,
      min_capacity_cubic_ft:
        q.min_capacity_cubic_ft != null ? Number(q.min_capacity_cubic_ft) : undefined,
      min_capacity_lbs:
        q.min_capacity_lbs != null ? Number(q.min_capacity_lbs) : undefined,
      search: typeof q.search === "string" ? q.search : undefined,
      sort_by,
      sort_order,
      limit,
      cursor: typeof q.cursor === "string" ? q.cursor : null,
    });
    res.status(200).json(ok(result.data, result.meta));
  }),
);

trucksRouter.post(
  "/",
  requirePermission("trucks:create"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const r = await createTruck({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      body: req.body as Record<string, unknown>,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: r.errors,
      });
      return;
    }
    res.status(201).json(ok(r.data, null));
  }),
);

trucksRouter.get(
  "/:id/availability",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const start = typeof req.query.start === "string" ? req.query.start.slice(0, 10) : "";
    const end = typeof req.query.end === "string" ? req.query.end.slice(0, 10) : "";
    if (!start || !end) {
      throw new HttpError(400, "VALIDATION", "start and end query params required", "start");
    }
    const id = String(req.params.id);
    const data = await getTruckAvailability(ctx.tenantId, id, start, end);
    if (!data) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(data, null));
  }),
);

trucksRouter.get(
  "/:id/assignments",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const status =
      typeof q.status === "string"
        ? q.status.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const id = String(req.params.id);
    const result = await listAssignmentsForTruck({
      tenantId: ctx.tenantId,
      truckId: id,
      date_range_start:
        typeof q.date_range_start === "string" ? q.date_range_start : undefined,
      date_range_end:
        typeof q.date_range_end === "string" ? q.date_range_end : undefined,
      status,
      limit,
      cursor: typeof q.cursor === "string" ? q.cursor : null,
    });
    res.status(200).json(
      ok(result.rows, {
        cursor: result.nextCursor,
        has_more: result.hasMore,
        total_count: result.total,
      }),
    );
  }),
);

trucksRouter.post(
  "/:id/assignments",
  requirePermission("trucks:assign"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await createAssignmentViaTruck({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      truckId: id,
      body: req.body as Record<string, unknown>,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: [{ code: r.code, message: r.message }],
      });
      return;
    }
    res.status(201).json(ok(r.data, { conflicts: r.conflicts }));
  }),
);

trucksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const data = await getTruck(ctx.tenantId, id);
    if (!data) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(data, null));
  }),
);

trucksRouter.put(
  "/:id",
  requirePermission("trucks:update"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await updateTruck({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      id,
      body: req.body as Record<string, unknown>,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: r.errors,
      });
      return;
    }
    res.status(200).json(ok(r.data, null));
  }),
);

trucksRouter.delete(
  "/:id",
  requirePermission("trucks:delete"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await retireTruckApi(ctx.tenantId, id);
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: r.errors,
      });
      return;
    }
    res.status(200).json(ok(r.data, null));
  }),
);

export const truckRoutesRouter = Router();
truckRoutesRouter.use(requestContextMiddleware);

truckRoutesRouter.post(
  "/",
  requirePermission("trucks:route"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const r = await createTruckRouteApi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      body: req.body as Record<string, unknown>,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: r.errors,
      });
      return;
    }
    res.status(201).json(ok(r.data, null));
  }),
);

truckRoutesRouter.put(
  "/:id",
  requirePermission("trucks:route"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await updateTruckRouteApi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      id,
      body: req.body as Record<string, unknown>,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: r.errors,
      });
      return;
    }
    res.status(200).json(ok(r.data, null));
  }),
);

truckRoutesRouter.get(
  "/:eventId",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const eventId = String(req.params.eventId);
    const result = await getTruckRoutesForEvent(ctx.tenantId, eventId);
    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Event not found");
    }
    res.status(200).json(ok(result.data, result.meta));
  }),
);
