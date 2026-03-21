import { Router } from "express";
import { ZodError } from "zod";
import { v7 as uuidv7 } from "uuid";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import {
  asyncHandler,
  requirePermission,
} from "../../core/middleware.js";
import { routeParam } from "../../core/route-params.js";
import { createContactsNestedRouter } from "../contacts/nested-routes.js";
import * as repo from "./repository.js";
import {
  bannerPreviewQuerySchema,
  createVenueSchema,
  listVenuesQuerySchema,
  resolveMapsLinkSchema,
  updateVenueSchema,
} from "./schemas.js";
import { resolveMapsLink } from "./resolve-maps-link.js";
import { fetchVenueBannerPng } from "./venue-banner.js";
import { writeAuditLog } from "../audit/service.js";
import { removeFromIndex } from "../search/service.js";
import { syncVenueSearchRow } from "../search/sync-entity.js";
import type { VenueResponse } from "@pld/shared";

export const venuesRouter = Router();

venuesRouter.use(
  "/:venueId/contacts",
  createContactsNestedRouter({
    parentType: "venue",
    paramKey: "venueId",
    readPerm: "venues:read",
    writePerm: "venues:update",
  }),
);

function encodeCursor(v: VenueResponse): string {
  return Buffer.from(JSON.stringify({ u: v.updated_at, id: v.id }), "utf8").toString(
    "base64url",
  );
}

function decodeCursor(
  raw: string | undefined,
): { u: string; id: string } | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      u?: string;
      id?: string;
    };
    if (j.u && j.id) return { u: j.u, id: j.id };
  } catch {
    return null;
  }
  return null;
}

venuesRouter.post(
  "/",
  requirePermission("venues:create"),
  asyncHandler(async (req, res) => {
    try {
      const body = createVenueSchema.parse(req.body);
      const id = uuidv7();
      const row = await repo.insertVenue(pool, {
        id,
        tenantId: req.ctx.tenantId,
        name: body.name,
        city: body.city ?? null,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        timezone: body.timezone ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? {},
      });
      void writeAuditLog(pool, {
        tenantId: req.ctx.tenantId,
        userId: req.ctx.userId,
        entityType: "venue",
        entityId: id,
        action: "create",
        changes: { after: { name: body.name } },
      }).catch(() => undefined);
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

venuesRouter.post(
  "/resolve-maps-link",
  requirePermission("venues:update"),
  asyncHandler(async (req, res) => {
    try {
      const body = resolveMapsLinkSchema.parse(req.body);
      const data = await resolveMapsLink(body.url);
      res.json(ok(data));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

venuesRouter.get(
  "/",
  requirePermission("venues:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = listVenuesQuerySchema.parse(req.query);
      const limit = q.limit ?? 25;
      const dec = decodeCursor(q.cursor);
      const rows = await repo.listVenues(
        pool,
        req.ctx.tenantId,
        q.search,
        limit + 1,
        dec?.u ?? null,
        dec?.id ?? null,
      );
      const total = await repo.countVenues(pool, req.ctx.tenantId, q.search);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const next = hasMore && page.length ? encodeCursor(page[page.length - 1]!) : null;
      res.json({
        data: page,
        meta: { cursor: next, has_more: next != null, total_count: total },
        errors: null,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

venuesRouter.get(
  "/:id/banner-preview",
  requirePermission("venues:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = bannerPreviewQuerySchema.parse(req.query);
      const row = await repo.getVenueById(pool, req.ctx.tenantId, routeParam(req.params.id));
      if (!row) {
        res.status(404).json(singleError("not_found", "Venue not found", 404).body);
        return;
      }
      if (row.latitude == null || row.longitude == null) {
        res.status(404).json(singleError("not_found", "Venue has no coordinates", 404).body);
        return;
      }
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        res.status(404).json(singleError("not_found", "Invalid coordinates", 404).body);
        return;
      }
      const png = await fetchVenueBannerPng({
        lat,
        lng,
        variant: q.variant,
      });
      if (!png?.length) {
        res.status(404).json(singleError("not_found", "Banner image unavailable", 404).body);
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(png);
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

venuesRouter.get(
  "/:id",
  requirePermission("venues:read"),
  asyncHandler(async (req, res) => {
    const row = await repo.getVenueById(pool, req.ctx.tenantId, routeParam(req.params.id));
    if (!row) {
      res.status(404).json(singleError("not_found", "Venue not found", 404).body);
      return;
    }
    res.json(ok(row));
  }),
);

venuesRouter.put(
  "/:id",
  requirePermission("venues:update"),
  asyncHandler(async (req, res) => {
    try {
      const body = updateVenueSchema.parse(req.body);
      const patch = { ...body } as Record<string, unknown>;
      const expected = patch.updated_at as string | undefined;
      delete patch.updated_at;
      if (Object.keys(patch).length === 0) {
        res.status(400).json(singleError("validation", "No fields to update", 400).body);
        return;
      }
      const updated = await repo.updateVenueRow(
        pool,
        req.ctx.tenantId,
        routeParam(req.params.id),
        patch,
        expected,
      );
      if (!updated && expected) {
        res.status(409).json(
          singleError("conflict", "Conflicting update (stale updated_at)", 409).body,
        );
        return;
      }
      if (!updated) {
        res.status(404).json(singleError("not_found", "Venue not found", 404).body);
        return;
      }
      void writeAuditLog(pool, {
        tenantId: req.ctx.tenantId,
        userId: req.ctx.userId,
        entityType: "venue",
        entityId: routeParam(req.params.id),
        action: "update",
        changes: { patch },
      }).catch(() => undefined);
      void syncVenueSearchRow(pool, req.ctx.tenantId, routeParam(req.params.id)).catch(() => undefined);
      res.json(ok(updated));
    } catch (e) {
      if (e instanceof ZodError) {
        res.status(400).json(singleError("validation", e.message, 400).body);
        return;
      }
      throw e;
    }
  }),
);

venuesRouter.delete(
  "/:id",
  requirePermission("venues:delete"),
  asyncHandler(async (req, res) => {
    const n = await repo.countEventsForVenue(
      pool,
      req.ctx.tenantId,
      routeParam(req.params.id),
    );
    if (n > 0) {
      res.status(409).json(
        singleError("conflict", "Venue has events; cannot delete", 409).body,
      );
      return;
    }
    const vid = routeParam(req.params.id);
    const del = await repo.softDeleteVenue(pool, req.ctx.tenantId, vid);
    if (!del) {
      res.status(404).json(singleError("not_found", "Venue not found", 404).body);
      return;
    }
    void writeAuditLog(pool, {
      tenantId: req.ctx.tenantId,
      userId: req.ctx.userId,
      entityType: "venue",
      entityId: vid,
      action: "delete",
      changes: {},
    }).catch(() => undefined);
    void removeFromIndex(pool, "venues", vid, req.ctx.tenantId).catch(() => undefined);
    res.json(ok(del));
  }),
);
