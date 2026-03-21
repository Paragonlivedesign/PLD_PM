import { Router } from "express";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import {
  asyncHandler,
  requestContextMiddleware,
  requirePermission,
} from "../../core/middleware.js";
import { bulkCreateAssignmentsApi } from "./bulk-assignments.service.js";
import {
  createCrewAssignmentApi,
  deleteCrewAssignmentApi,
  getCrewAssignment,
  listCrewAssignmentsApi,
  updateCrewAssignmentApi,
} from "./crew-assignments.service.js";
import {
  createTruckAssignmentApi,
  deleteTruckAssignmentApi,
  getTruckAssignment,
  listTruckAssignmentsApi,
  updateTruckAssignmentApi,
} from "./truck-assignments.service.js";

export const assignmentsRouter = Router();
assignmentsRouter.use(requestContextMiddleware);

assignmentsRouter.post(
  "/crew",
  requirePermission("scheduling:create"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const b = req.body as Record<string, unknown>;
    const r = await createCrewAssignmentApi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      eventId: String(b.event_id ?? ""),
      personnelId: String(b.personnel_id ?? ""),
      role: String(b.role ?? ""),
      departmentId: b.department_id != null ? String(b.department_id) : null,
      startDate: String(b.start_date ?? "").slice(0, 10),
      endDate: String(b.end_date ?? "").slice(0, 10),
      startTime: b.start_time != null ? String(b.start_time) : null,
      endTime: b.end_time != null ? String(b.end_time) : null,
      dayRateOverride:
        b.day_rate_override !== undefined && b.day_rate_override !== null
          ? Number(b.day_rate_override)
          : null,
      perDiemOverride:
        b.per_diem_override !== undefined && b.per_diem_override !== null
          ? Number(b.per_diem_override)
          : null,
      notes: b.notes != null ? String(b.notes) : null,
      status: b.status != null ? String(b.status) : "tentative",
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: [{ code: r.code, message: r.message, field: r.field }],
      });
      return;
    }
    res.status(201).json(ok(r.data, { conflicts: r.conflicts }));
  }),
);

assignmentsRouter.get(
  "/crew",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const statusCsv = typeof q.status === "string" ? q.status : undefined;
    const status = statusCsv?.split(",").map((s) => s.trim()).filter(Boolean);
    const sortByRaw = typeof q.sort_by === "string" ? q.sort_by : "start_date";
    const sortBy =
      sortByRaw === "personnel_name" ||
      sortByRaw === "event_name" ||
      sortByRaw === "created_at"
        ? sortByRaw
        : "start_date";
    const sortOrder = q.sort_order === "desc" ? "desc" : "asc";
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const result = await listCrewAssignmentsApi({
      tenantId: ctx.tenantId,
      eventId: typeof q.event_id === "string" ? q.event_id : undefined,
      personnelId: typeof q.personnel_id === "string" ? q.personnel_id : undefined,
      departmentId: typeof q.department_id === "string" ? q.department_id : undefined,
      status,
      dateRangeStart:
        typeof q.date_range_start === "string" ? q.date_range_start : undefined,
      dateRangeEnd:
        typeof q.date_range_end === "string" ? q.date_range_end : undefined,
      sortBy,
      sortOrder,
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

assignmentsRouter.get(
  "/crew/:id",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const data = await getCrewAssignment(ctx.tenantId, id);
    if (!data) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(data, null));
  }),
);

assignmentsRouter.put(
  "/crew/:id",
  requirePermission("scheduling:update"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const b = req.body as Record<string, unknown>;
    const r = await updateCrewAssignmentApi(ctx.tenantId, ctx.userId, id, {
      role: b.role !== undefined ? String(b.role) : undefined,
      departmentId:
        b.department_id !== undefined
          ? b.department_id === null
            ? null
            : String(b.department_id)
          : undefined,
      departmentName:
        b.department_name !== undefined
          ? b.department_name === null
            ? null
            : String(b.department_name)
          : undefined,
      startDate: b.start_date != null ? String(b.start_date).slice(0, 10) : undefined,
      endDate: b.end_date != null ? String(b.end_date).slice(0, 10) : undefined,
      startTime:
        b.start_time !== undefined
          ? b.start_time === null
            ? null
            : String(b.start_time)
          : undefined,
      endTime:
        b.end_time !== undefined ? (b.end_time === null ? null : String(b.end_time)) : undefined,
      dayRateOverride:
        b.day_rate_override !== undefined
          ? b.day_rate_override === null
            ? null
            : Number(b.day_rate_override)
          : undefined,
      perDiemOverride:
        b.per_diem_override !== undefined
          ? b.per_diem_override === null
            ? null
            : Number(b.per_diem_override)
          : undefined,
      notes: b.notes !== undefined ? (b.notes === null ? null : String(b.notes)) : undefined,
      status: b.status != null ? String(b.status) : undefined,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: [{ code: r.code, message: r.message, field: r.field }],
      });
      return;
    }
    res.status(200).json(ok(r.data, { conflicts: r.conflicts }));
  }),
);

assignmentsRouter.delete(
  "/crew/:id",
  requirePermission("scheduling:delete"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await deleteCrewAssignmentApi(ctx.tenantId, ctx.userId, id);
    if (!r.ok) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(r.data, null));
  }),
);

assignmentsRouter.post(
  "/bulk",
  requirePermission("scheduling:create"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const b = req.body as {
      assignments?: unknown[];
      conflict_strategy?: string;
    };
    const raw = Array.isArray(b.assignments) ? b.assignments : [];
    const strategyRaw = b.conflict_strategy ?? "fail";
    const conflictStrategy =
      strategyRaw === "warn" || strategyRaw === "skip" ? strategyRaw : "fail";
    const assignments = raw.map((item) => {
      const x = item as Record<string, unknown>;
      return {
        type: x.type === "truck" ? ("truck" as const) : ("crew" as const),
        event_id: String(x.event_id ?? ""),
        resource_id: String(x.resource_id ?? ""),
        role: x.role != null ? String(x.role) : undefined,
        start_date: String(x.start_date ?? "").slice(0, 10),
        end_date: String(x.end_date ?? "").slice(0, 10),
        status: x.status != null ? String(x.status) : undefined,
        notes: x.notes != null ? String(x.notes) : null,
      };
    });
    const r = await bulkCreateAssignmentsApi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      assignments,
      conflictStrategy,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: [{ code: r.code, message: r.message }],
      });
      return;
    }
    res.status(201).json(ok(r.data, r.meta));
  }),
);

assignmentsRouter.post(
  "/truck",
  requirePermission("scheduling:create"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const b = req.body as Record<string, unknown>;
    const r = await createTruckAssignmentApi({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      eventId: String(b.event_id ?? ""),
      truckId: String(b.truck_id ?? ""),
      purpose: b.purpose != null ? String(b.purpose) : null,
      startDate: String(b.start_date ?? "").slice(0, 10),
      endDate: String(b.end_date ?? "").slice(0, 10),
      driverId: b.driver_id != null ? String(b.driver_id) : null,
      notes: b.notes != null ? String(b.notes) : null,
      status: b.status != null ? String(b.status) : "tentative",
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

assignmentsRouter.get(
  "/truck",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const statusCsv = typeof q.status === "string" ? q.status : undefined;
    const status = statusCsv?.split(",").map((s) => s.trim()).filter(Boolean);
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const result = await listTruckAssignmentsApi({
      tenantId: ctx.tenantId,
      eventId: typeof q.event_id === "string" ? q.event_id : undefined,
      truckId: typeof q.truck_id === "string" ? q.truck_id : undefined,
      driverId: typeof q.driver_id === "string" ? q.driver_id : undefined,
      status,
      dateRangeStart:
        typeof q.date_range_start === "string" ? q.date_range_start : undefined,
      dateRangeEnd:
        typeof q.date_range_end === "string" ? q.date_range_end : undefined,
      limit,
      cursorId: typeof q.cursor === "string" ? q.cursor : null,
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

assignmentsRouter.get(
  "/truck/:id",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const data = await getTruckAssignment(ctx.tenantId, id);
    if (!data) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(data, null));
  }),
);

assignmentsRouter.put(
  "/truck/:id",
  requirePermission("scheduling:update"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const b = req.body as Record<string, unknown>;
    const r = await updateTruckAssignmentApi(ctx.tenantId, ctx.userId, id, {
      purpose: b.purpose !== undefined ? (b.purpose === null ? null : String(b.purpose)) : undefined,
      startDate: b.start_date != null ? String(b.start_date).slice(0, 10) : undefined,
      endDate: b.end_date != null ? String(b.end_date).slice(0, 10) : undefined,
      driverId:
        b.driver_id !== undefined
          ? b.driver_id === null
            ? null
            : String(b.driver_id)
          : undefined,
      notes: b.notes !== undefined ? (b.notes === null ? null : String(b.notes)) : undefined,
      status: b.status != null ? String(b.status) : undefined,
    });
    if (!r.ok) {
      res.status(r.status).json({
        data: null,
        meta: null,
        errors: [{ code: r.code, message: r.message }],
      });
      return;
    }
    res.status(200).json(ok(r.data, { conflicts: r.conflicts }));
  }),
);

assignmentsRouter.delete(
  "/truck/:id",
  requirePermission("scheduling:delete"),
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const id = String(req.params.id);
    const r = await deleteTruckAssignmentApi(ctx.tenantId, ctx.userId, id);
    if (!r.ok) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }
    res.status(200).json(ok(r.data, null));
  }),
);

/** @deprecated use assignmentsRouter */
export const assignmentsTruckRouter = assignmentsRouter;
