import { Router } from "express";
import { v7 as uuidv7 } from "uuid";
import { ZodError, z } from "zod";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
} from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import { tryGetContext } from "../../core/context.js";
import { findUserById } from "../auth/repository.js";
import * as repo from "./repository.js";

export const timeRouter = Router();
export const payPeriodsRouter = Router();
export const payrollRouter = Router();

const clockBodySchema = z.object({
  event_id: z.string().uuid().optional().nullable(),
  crew_assignment_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createPeriodSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pay_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

async function requirePersonnelId(
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const user = await findUserById(pool, tenantId, userId);
  return user?.personnel_id ?? null;
}

timeRouter.post(
  "/clock-in",
  requirePermission("time:clock:self"),
  asyncHandler(async (req, res) => {
    const pid = await requirePersonnelId(req.ctx.tenantId, req.ctx.userId);
    if (!pid) {
      res.status(400).json(
        singleError("validation", "User is not linked to personnel", 400).body,
      );
      return;
    }
    try {
      const body = clockBodySchema.parse(req.body ?? {});
      const open = await repo.findOpenTimeEntry(pool, req.ctx.tenantId, pid);
      if (open) {
        res.status(409).json(
          singleError("conflict", "Already clocked in; clock out first", 409).body,
        );
        return;
      }
      const row = await repo.insertTimeEntry(pool, {
        id: uuidv7(),
        tenantId: req.ctx.tenantId,
        personnelId: pid,
        eventId: body.event_id ?? null,
        crewAssignmentId: body.crew_assignment_id ?? null,
        notes: body.notes ?? null,
        metadata: {},
      });
      res.status(201).json(ok(row));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

timeRouter.post(
  "/clock-out",
  requirePermission("time:clock:self"),
  asyncHandler(async (req, res) => {
    const pid = await requirePersonnelId(req.ctx.tenantId, req.ctx.userId);
    if (!pid) {
      res.status(400).json(
        singleError("validation", "User is not linked to personnel", 400).body,
      );
      return;
    }
    const open = await repo.findOpenTimeEntry(pool, req.ctx.tenantId, pid);
    if (!open) {
      res.status(409).json(singleError("conflict", "No open time entry", 409).body);
      return;
    }
    const closed = await repo.closeTimeEntry(pool, req.ctx.tenantId, pid, open.id);
    if (!closed) {
      res.status(409).json(singleError("conflict", "Could not clock out", 409).body);
      return;
    }
    res.json(ok(closed));
  }),
);

timeRouter.get(
  "/entries",
  requireAnyPermission("time:read", "time:clock:self"),
  asyncHandler(async (req, res) => {
    const ctx = tryGetContext();
    const perm = ctx?.permissions ?? new Set<string>();
    const canReadAll = perm.has("*") || perm.has("time:read");
    const qPid = typeof req.query.personnel_id === "string" ? req.query.personnel_id : undefined;
    let filterPid: string | undefined = qPid;
    if (!canReadAll) {
      const selfPid = await requirePersonnelId(req.ctx.tenantId, req.ctx.userId);
      if (!selfPid) {
        res.json(ok([], { scope: "self", personnel_linked: false }));
        return;
      }
      if (qPid && qPid !== selfPid) {
        res.status(403).json(
          singleError("forbidden", "May only list own time entries", 403).body,
        );
        return;
      }
      filterPid = selfPid;
    }
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const rows = await repo.listTimeEntries(pool, req.ctx.tenantId, filterPid, limit);
    res.json(ok(rows, { total_count: rows.length }));
  }),
);

payPeriodsRouter.get(
  "/",
  requireAnyPermission(
    "payroll:view_all",
    "payroll:view_own",
    "payroll:run",
    "payroll:export",
  ),
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const rows = await repo.listPayPeriods(pool, req.ctx.tenantId, limit);
    res.json(ok(rows, { total_count: rows.length }));
  }),
);

payPeriodsRouter.post(
  "/",
  requirePermission("payroll:run"),
  asyncHandler(async (req, res) => {
    try {
      const body = createPeriodSchema.parse(req.body);
      const row = await repo.insertPayPeriod(pool, {
        id: uuidv7(),
        tenantId: req.ctx.tenantId,
        periodStart: body.period_start,
        periodEnd: body.period_end,
        payDate: body.pay_date ?? null,
        metadata: body.metadata ?? {},
      });
      res.status(201).json(ok(row));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

payPeriodsRouter.get(
  "/:id/statements",
  requireAnyPermission("payroll:view_all", "payroll:run"),
  asyncHandler(async (req, res) => {
    const periodId = routeParam(req.params.id);
    const n = await repo.countPayStatementsForPeriod(
      pool,
      req.ctx.tenantId,
      periodId,
    );
    res.json(
      ok([], {
        pay_period_id: periodId,
        statement_count: n,
        note: "Pay statement rows ship in a later phase; this endpoint is a shell.",
      }),
    );
  }),
);

payrollRouter.get(
  "/export",
  requirePermission("payroll:export"),
  asyncHandler(async (_req, res) => {
    res.json(
      ok({
        format: "adp_csv_v0",
        message:
          "Export-first payroll: wire column mapping and storage in a later phase.",
        rows: [] as unknown[],
      }),
    );
  }),
);
