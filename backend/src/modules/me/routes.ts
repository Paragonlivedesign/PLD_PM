import { Router } from "express";
import { ok } from "../../http/envelope.js";
import {
  asyncHandler,
  requirePermission,
} from "../../core/middleware.js";
import { findUserById } from "../auth/repository.js";
import { pool } from "../../db/pool.js";
import { listCrewAssignmentsApi } from "../scheduling/crew-assignments.service.js";

export const meRouter = Router();

meRouter.get(
  "/crew-assignments",
  requirePermission("scheduling:read:self"),
  asyncHandler(async (req, res) => {
    const user = await findUserById(pool, req.ctx.tenantId, req.ctx.userId);
    if (!user?.personnel_id) {
      res.json(
        ok([], {
          personnel_linked: false,
          note: "No personnel profile linked to this user.",
        }),
      );
      return;
    }
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
      tenantId: req.ctx.tenantId,
      personnelId: user.personnel_id,
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
    res.status(200).json({
      data: result.rows,
      meta: {
        cursor: result.nextCursor,
        has_more: result.hasMore,
        total_count: result.total,
        personnel_id: user.personnel_id,
      },
      errors: null,
    });
  }),
);
