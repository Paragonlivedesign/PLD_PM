import { Router } from "express";
import { ZodError } from "zod";
import { ok, singleError, fail } from "../../http/envelope.js";
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
} from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import {
  cloneEventSchema,
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
  updatePhaseSchema,
} from "./schemas.js";
import * as svc from "./service.js";
import { eventTravelQuerySchema, roomingQuerySchema } from "../travel/schemas.js";
import * as travelSvc from "../travel/service.js";

export const eventsRouter = Router();

eventsRouter.post(
  "/",
  requirePermission("events:create"),
  asyncHandler(async (req, res) => {
    try {
      const body = createEventSchema.parse(req.body);
      const r = await svc.createEvent(req.ctx.tenantId, req.ctx.userId, body);
      if (!r.ok) {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
        return;
      }
      res.status(201).json(ok(r.event));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.get(
  "/",
  requirePermission("events:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = listEventsQuerySchema.parse(req.query);
      const { rows, total, nextCursor } = await svc.listEventsQuery(
        req.ctx.tenantId,
        q,
      );
      res.json({
        data: rows,
        meta: {
          cursor: nextCursor,
          has_more: nextCursor != null,
          total_count: total,
        },
        errors: null,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.get(
  "/:id/travel",
  requirePermission("events:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = eventTravelQuerySchema.parse(req.query);
      const r = await travelSvc.getEventTravelManifestApi({
        tenantId: req.ctx.tenantId,
        eventId: routeParam(req.params.id),
        query: q as unknown as Record<string, unknown>,
      });
      if (!r.ok) {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
        return;
      }
      res.json({ data: r.data, meta: r.meta, errors: null });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.get(
  "/:id/rooming",
  requirePermission("events:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = roomingQuerySchema.parse(req.query);
      const r = await travelSvc.getRoomingForEventApi({
        tenantId: req.ctx.tenantId,
        eventId: routeParam(req.params.id),
        query: q as unknown as Record<string, unknown>,
      });
      if (!r.ok) {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
        return;
      }
      res.json({ data: r.data, meta: r.meta, errors: null });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.get(
  "/:id",
  requirePermission("events:read"),
  asyncHandler(async (req, res) => {
    const ev = await svc.getEvent(req.ctx.tenantId, routeParam(req.params.id));
    if (!ev) {
      res.status(404).json(singleError("not_found", "Event not found", 404).body);
      return;
    }
    res.json(ok(ev));
  }),
);

eventsRouter.put(
  "/:id",
  requirePermission("events:update"),
  asyncHandler(async (req, res) => {
    try {
      const body = updateEventSchema.parse(req.body);
      const patch = { ...body } as Record<string, unknown>;
      delete patch.updated_at;
      if (Object.keys(patch).length === 0) {
        res.status(400).json(
          singleError("validation", "No fields to update", 400).body,
        );
        return;
      }
      const r = await svc.updateEvent(req.ctx.tenantId, req.ctx.userId, routeParam(req.params.id), body);
      if (!r.ok) {
        res.status(r.status).json(
          singleError(r.code, r.message, r.status, r.field).body,
        );
        return;
      }
      res.json(ok(r.event));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.delete(
  "/:id",
  requirePermission("events:delete"),
  asyncHandler(async (req, res) => {
    const q = req.query.force;
    const force =
      q === "true" ||
      q === "1" ||
      (Array.isArray(q) && (q[0] === "true" || q[0] === "1"));
    const r = await svc.deleteEvent(req.ctx.tenantId, req.ctx.userId, routeParam(req.params.id), {
      force,
    });
    if (!r.ok) {
      if (r.details !== undefined) {
        res.status(r.status).json(fail([{ code: r.code, message: r.message, details: r.details }], r.status).body);
      } else {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
      }
      return;
    }
    res.json(ok(r.deleted));
  }),
);

eventsRouter.post(
  "/:id/restore",
  requireAnyPermission("tenancy.settings.edit"),
  asyncHandler(async (req, res) => {
    const r = await svc.restoreSoftDeletedEvent(
      req.ctx.tenantId,
      req.ctx.userId,
      routeParam(req.params.id),
    );
    if (!r.ok) {
      res.status(r.status).json(singleError(r.code, r.message, r.status).body);
      return;
    }
    res.json(ok(r.event));
  }),
);

eventsRouter.post(
  "/:id/clone",
  requirePermission("events:create"),
  asyncHandler(async (req, res) => {
    try {
      const body = cloneEventSchema.parse(req.body);
      const r = await svc.cloneEvent(req.ctx.tenantId, req.ctx.userId, routeParam(req.params.id), body);
      if (!r.ok) {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
        return;
      }
      res.status(201).json({
        data: r.event,
        meta: { cloned_from: r.cloned_from },
        errors: null,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);

eventsRouter.put(
  "/:id/phase",
  requirePermission("events:update"),
  asyncHandler(async (req, res) => {
    try {
      const body = updatePhaseSchema.parse(req.body);
      const r = await svc.transitionPhase(
        req.ctx.tenantId,
        req.ctx.userId,
        routeParam(req.params.id),
        body.phase,
        body.notes,
      );
      if (!r.ok) {
        res.status(r.status).json(singleError(r.code, r.message, r.status).body);
        return;
      }
      res.json({
        data: r.event,
        meta: {
          previous_phase: r.previous_phase,
          new_phase: r.new_phase,
          transitioned_at: r.transitioned_at,
        },
        errors: null,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(
          singleError("validation", e.message, 400, undefined).body,
        );
        return;
      }
      throw e;
    }
  }),
);
