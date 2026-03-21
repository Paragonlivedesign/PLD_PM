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
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from "./schemas.js";
import { writeAuditLog } from "../audit/service.js";
import { removeFromIndex } from "../search/service.js";
import { syncClientSearchRow } from "../search/sync-entity.js";
import type { ClientResponse } from "@pld/shared";

export const clientsRouter = Router();

clientsRouter.use(
  "/:clientId/contacts",
  createContactsNestedRouter({
    parentType: "client_organization",
    paramKey: "clientId",
    readPerm: "clients:read",
    writePerm: "clients:update",
  }),
);

function encodeCursor(c: ClientResponse): string {
  return Buffer.from(JSON.stringify({ u: c.updated_at, id: c.id }), "utf8").toString(
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

clientsRouter.post(
  "/",
  requirePermission("clients:create"),
  asyncHandler(async (req, res) => {
    try {
      const body = createClientSchema.parse(req.body);
      const id = uuidv7();
      const row = await repo.insertClient(pool, {
        id,
        tenantId: req.ctx.tenantId,
        name: body.name,
        contactName: body.contact_name ?? null,
        contactEmail: body.contact_email || null,
        phone: body.phone ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? {},
      });
      void writeAuditLog(pool, {
        tenantId: req.ctx.tenantId,
        userId: req.ctx.userId,
        entityType: "client",
        entityId: id,
        action: "create",
        changes: { after: { name: body.name } },
      }).catch(() => undefined);
      void syncClientSearchRow(pool, req.ctx.tenantId, id).catch(() => undefined);
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

clientsRouter.get(
  "/",
  requirePermission("clients:read"),
  asyncHandler(async (req, res) => {
    try {
      const q = listClientsQuerySchema.parse(req.query);
      const limit = q.limit ?? 25;
      const dec = decodeCursor(q.cursor);
      const rows = await repo.listClients(
        pool,
        req.ctx.tenantId,
        q.search,
        limit + 1,
        dec?.u ?? null,
        dec?.id ?? null,
      );
      const total = await repo.countClientsForList(pool, req.ctx.tenantId, q.search);
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

clientsRouter.get(
  "/:id",
  requirePermission("clients:read"),
  asyncHandler(async (req, res) => {
    const row = await repo.getClientById(pool, req.ctx.tenantId, routeParam(req.params.id));
    if (!row) {
      res.status(404).json(singleError("not_found", "Client not found", 404).body);
      return;
    }
    res.json(ok(row));
  }),
);

clientsRouter.put(
  "/:id",
  requirePermission("clients:update"),
  asyncHandler(async (req, res) => {
    try {
      const body = updateClientSchema.parse(req.body);
      const patch = { ...body } as Record<string, unknown>;
      const expected = patch.updated_at as string | undefined;
      delete patch.updated_at;
      if (Object.keys(patch).length === 0) {
        res.status(400).json(singleError("validation", "No fields to update", 400).body);
        return;
      }
      const updated = await repo.updateClientRow(
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
        res.status(404).json(singleError("not_found", "Client not found", 404).body);
        return;
      }
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

clientsRouter.delete(
  "/:id",
  requirePermission("clients:delete"),
  asyncHandler(async (req, res) => {
    const n = await repo.countEventsForClient(
      pool,
      req.ctx.tenantId,
      routeParam(req.params.id),
    );
    if (n > 0) {
      res.status(409).json(
        singleError(
          "conflict",
          "Client has events; cannot delete",
          409,
        ).body,
      );
      return;
    }
    const cid = routeParam(req.params.id);
    const del = await repo.softDeleteClient(pool, req.ctx.tenantId, cid);
    if (!del) {
      res.status(404).json(singleError("not_found", "Client not found", 404).body);
      return;
    }
    void writeAuditLog(pool, {
      tenantId: req.ctx.tenantId,
      userId: req.ctx.userId,
      entityType: "client",
      entityId: cid,
      action: "delete",
      changes: {},
    }).catch(() => undefined);
    void removeFromIndex(pool, "clients", cid, req.ctx.tenantId).catch(() => undefined);
    res.json(ok(del));
  }),
);
