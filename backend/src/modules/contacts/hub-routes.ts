import { Router } from "express";
import { ok, singleError } from "../../http/envelope.js";
import { pool } from "../../db/pool.js";
import { asyncHandler, requireAnyPermission } from "../../core/middleware.js";
import { tryGetContext } from "../../core/context.js";
import type { ContactParentType } from "@pld/shared";
import {
  listContactPersonsForHub,
  type HubPersonRow,
} from "./person-repository.js";
import { writeAuditLog } from "../audit/service.js";

function filterHubByPermissions(
  rows: HubPersonRow[],
  permissions: Set<string>,
): HubPersonRow[] {
  const has = (p: string) => permissions.has("*") || permissions.has(p);
  const canReadMembership = (pt: ContactParentType): boolean => {
    if (pt === "client_organization") return has("clients:read");
    if (pt === "venue") return has("venues:read");
    if (pt === "vendor_organization") return has("vendors:read");
    return false;
  };
  return rows
    .map((row) => ({
      ...row,
      memberships: row.memberships.filter((m) => canReadMembership(m.parent_type)),
    }))
    .filter((row) => row.memberships.length > 0);
}

export const contactPersonsHubRouter = Router();

contactPersonsHubRouter.get(
  "/",
  requireAnyPermission("clients:read", "venues:read", "vendors:read"),
  asyncHandler(async (req, res) => {
    const ctx = tryGetContext();
    if (!ctx) {
      res.status(500).json(singleError("INTERNAL", "Missing context", 500).body);
      return;
    }
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );
    const search = req.query.search != null ? String(req.query.search) : "";
    const parentType = req.query.parent_type
      ? (String(req.query.parent_type) as ContactParentType)
      : null;
    const parentId = req.query.parent_id ? String(req.query.parent_id) : null;

    const rows = await listContactPersonsForHub(pool, ctx.tenantId, {
      limit,
      search: search || null,
      parentType: parentType && parentId ? parentType : null,
      parentId: parentType && parentId ? parentId : null,
    });
    const filtered = filterHubByPermissions(rows, ctx.permissions);
    res.json(
      ok(filtered, {
        limit,
        count: filtered.length,
      }),
    );
  }),
);

/** CSV export (sync); one row per membership. */
contactPersonsHubRouter.get(
  "/export",
  requireAnyPermission("clients:read", "venues:read", "vendors:read"),
  asyncHandler(async (req, res) => {
    const ctx = tryGetContext();
    if (!ctx) {
      res.status(500).json(singleError("INTERNAL", "Missing context", 500).body);
      return;
    }
    const rows = await listContactPersonsForHub(pool, ctx.tenantId, {
      limit: 10000,
      search: req.query.search != null ? String(req.query.search) : null,
      parentType: null,
      parentId: null,
    });
    const filtered = filterHubByPermissions(rows, ctx.permissions);
    const lines = [
      [
        "person_id",
        "membership_id",
        "parent_type",
        "parent_id",
        "display_name",
        "primary_email",
        "title",
        "is_primary",
      ].join(","),
    ];
    for (const p of filtered) {
      const primary =
        p.emails.find((e) => e.is_primary)?.address ??
        p.emails[0]?.address ??
        "";
      for (const m of p.memberships) {
        const esc = (s: string) =>
          `"${String(s).replace(/"/g, '""')}"`;
        lines.push(
          [
            p.id,
            m.membership_id,
            m.parent_type,
            m.parent_id,
            esc(p.display_name),
            esc(primary),
            m.title != null ? esc(m.title) : "",
            m.is_primary ? "true" : "false",
          ].join(","),
        );
      }
    }
    const csv = lines.join("\r\n");
    try {
      await writeAuditLog(pool, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        entityType: "contacts_export",
        entityId: ctx.tenantId,
        action: "data_export",
        changes: {
          row_count: filtered.reduce((n, r) => n + r.memberships.length, 0),
          filters: { search: req.query.search ?? null },
        },
      });
    } catch {
      /* best-effort audit when tenant row missing in dev/test */
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="contacts-export.csv"',
    );
    res.send(csv);
  }),
);

contactPersonsHubRouter.post(
  "/import/dry-run",
  requireAnyPermission("clients:update", "venues:update", "vendors:update"),
  asyncHandler(async (_req, res) => {
    res.json(ok({ staged: [], conflicts: [] }));
  }),
);

contactPersonsHubRouter.patch(
  "/bulk",
  requireAnyPermission("*"),
  asyncHandler(async (_req, res) => {
    res.status(501).json({
      data: null,
      meta: null,
      errors: [
        {
          code: "not_implemented",
          message: "Bulk contact-person patch is not implemented yet",
        },
      ],
    });
  }),
);
