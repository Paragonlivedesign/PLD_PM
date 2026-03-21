import type { Router } from "express";
import { Router as createRouter } from "express";
import type { Pool } from "pg";
import { fail, ok } from "../../core/envelope.js";
import { getContext } from "../../core/context.js";
import {
  asyncHandler,
  requestContextMiddleware,
  requirePermission,
} from "../../core/middleware.js";
import { ENTITY_TYPES, FIELD_TYPES, type EntityType, type FieldType } from "./constants.js";
import * as service from "./service.js";

function parseEntityType(q: unknown): EntityType | null {
  if (typeof q !== "string") return null;
  return ENTITY_TYPES.includes(q as EntityType) ? (q as EntityType) : null;
}

function parseFieldType(v: unknown): FieldType | null {
  if (typeof v !== "string") return null;
  return FIELD_TYPES.includes(v as FieldType) ? (v as FieldType) : null;
}

export function customFieldsRouter(pool: Pool): Router {
  const r = createRouter();
  r.use(requestContextMiddleware);

  r.get(
    "/",
    asyncHandler(async (req, res) => {
      const entityType = parseEntityType(req.query.entity_type);
      if (!entityType) {
        res.status(400).json(fail([{ code: "invalid_query", message: "entity_type is required and must be valid" }]));
        return;
      }
      const includeDeprecated = req.query.include_deprecated === "true";
      const data = await service.getFieldDefinitions(pool, getContext().tenantId, entityType, {
        include_deprecated: includeDeprecated,
      });
      res.status(200).json(ok(data, { total_count: data.length, entity_type: entityType }));
    }),
  );

  r.post(
    "/",
    requirePermission("custom_fields.definitions.manage"),
    asyncHandler(async (req, res) => {
      const ctx = getContext();
      const b = req.body as Record<string, unknown>;
      const entityType = parseEntityType(b.entity_type);
      const fieldType = parseFieldType(b.field_type);
      if (!entityType || !fieldType || typeof b.field_key !== "string" || typeof b.label !== "string") {
        res.status(400).json(fail([{ code: "validation_error", message: "Invalid create body" }]));
        return;
      }
      const out = await service.createDefinition(pool, ctx.tenantId, ctx.userId, {
        entity_type: entityType,
        field_key: b.field_key,
        label: b.label,
        description: typeof b.description === "string" ? b.description : null,
        field_type: fieldType,
        validation_rules: (b.validation_rules as object) ?? null,
        default_value: b.default_value,
        options: Array.isArray(b.options) ? (b.options as never) : null,
        is_required: Boolean(b.is_required),
        is_searchable: Boolean(b.is_searchable),
        display_order: typeof b.display_order === "number" ? b.display_order : null,
        visibility: b.visibility === "admin_only" ? "admin_only" : "all",
      });
      if (!out.ok) {
        res.status(out.status).json(fail([{ code: out.code, message: out.message }]));
        return;
      }
      res.status(201).json(ok(out.data, null));
    }),
  );

  r.put(
    "/reorder",
    requirePermission("custom_fields.definitions.manage"),
    asyncHandler(async (req, res) => {
      const ctx = getContext();
      const b = req.body as { entity_type?: unknown; ordered_ids?: unknown };
      const entityType = parseEntityType(b.entity_type);
      const orderedIds = Array.isArray(b.ordered_ids)
        ? b.ordered_ids.filter((x): x is string => typeof x === "string")
        : null;
      if (!entityType || !orderedIds) {
        res.status(400).json(fail([{ code: "validation_error", message: "entity_type and ordered_ids[] required" }]));
        return;
      }
      const out = await service.reorderDefinitions(pool, ctx.tenantId, entityType, orderedIds);
      if (!out.ok) {
        res.status(out.status).json(fail([{ code: out.code, message: out.message }]));
        return;
      }
      res.status(200).json(ok(out.data, null));
    }),
  );

  r.put(
    "/:id",
    requirePermission("custom_fields.definitions.manage"),
    asyncHandler(async (req, res) => {
      const ctx = getContext();
      const defId = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
      const b = req.body as Record<string, unknown>;
      if (Object.keys(b).length === 0) {
        res.status(400).json(fail([{ code: "validation_error", message: "No fields to update" }]));
        return;
      }
      const out = await service.updateDefinition(pool, ctx.tenantId, ctx.userId, defId, {
        ...(typeof b.label === "string" ? { label: b.label } : {}),
        ...(b.description !== undefined
          ? { description: b.description === null ? null : String(b.description) }
          : {}),
        ...(b.validation_rules !== undefined ? { validation_rules: b.validation_rules as never } : {}),
        ...(b.default_value !== undefined ? { default_value: b.default_value } : {}),
        ...(Array.isArray(b.options) ? { options: b.options as never } : {}),
        ...(typeof b.is_required === "boolean" ? { is_required: b.is_required } : {}),
        ...(typeof b.is_searchable === "boolean" ? { is_searchable: b.is_searchable } : {}),
        ...(typeof b.display_order === "number" ? { display_order: b.display_order } : {}),
        ...(b.visibility === "admin_only" || b.visibility === "all" ? { visibility: b.visibility } : {}),
      });
      if (!out.ok) {
        res.status(out.status).json(fail([{ code: out.code, message: out.message }]));
        return;
      }
      res.status(200).json(ok(out.data, out.meta));
    }),
  );

  r.delete(
    "/:id",
    requirePermission("custom_fields.definitions.manage"),
    asyncHandler(async (req, res) => {
      const ctx = getContext();
      const defId = typeof req.params.id === "string" ? req.params.id : req.params.id[0]!;
      const out = await service.deleteDefinition(pool, ctx.tenantId, ctx.userId, defId);
      if (!out.ok) {
        res.status(out.status).json(fail([{ code: out.code, message: out.message }]));
        return;
      }
      res.status(200).json(ok(out.data, null));
    }),
  );

  return r;
}
