import { randomUUID } from "node:crypto";
import { getContext, hasPermission } from "../../core/context.js";
import { HttpError } from "../../core/http-error.js";
import { pool } from "../../core/database.js";
import * as deptRepo from "./department.repository.js";
import * as tenantRepo from "./tenant.repository.js";
import {
  emitDepartmentCreated,
  emitDepartmentDeleted,
  emitDepartmentReordered,
  emitDepartmentUpdated,
  emitTenantConfigUpdated,
} from "./tenancy.events.js";
import { tenantCacheInvalidate, tenantCacheGet, tenantCacheSet } from "./tenant-cache.js";
import {
  mergeSettingsJson,
  parsePartialTenantSettings,
  resolveTenantSettings,
} from "./tenant-settings.js";
import type {
  DepartmentResponse,
  TenantResponse,
  TenantRow,
  TenantSettingsResolved,
} from "./types.js";
import * as pRepo from "../personnel/personnel.repository.js";

export async function getCurrentTenant(tenantId: string): Promise<TenantResponse | null> {
  const row = await loadTenantRow(tenantId);
  if (!row || row.status !== "active") return null;
  const raw = (row.settings ?? {}) as Record<string, unknown>;
  const settings = resolveTenantSettings(raw, row.name);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    settings,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getTenantConfig(tenantId: string): Promise<TenantSettingsResolved> {
  const row = await loadTenantRow(tenantId);
  if (!row) {
    return resolveTenantSettings({}, "");
  }
  const raw = row.settings as Record<string, unknown>;
  return resolveTenantSettings(raw, row.name);
}

export async function getDepartments(
  tenantId: string,
  options?: { include_inactive?: boolean; ids?: string[] },
): Promise<DepartmentResponse[]> {
  const filter = options?.include_inactive ? "all" : "active_only";
  const rows = await deptRepo.listDepartments(pool, tenantId, filter, false);
  if (options?.ids?.length) {
    const set = new Set(options.ids);
    return rows.filter((r) => set.has(r.id));
  }
  return rows;
}

async function loadTenantRow(tenantId: string): Promise<TenantRow | null> {
  const cached = tenantCacheGet(tenantId);
  if (cached) return cached;
  const row = await tenantRepo.findTenantById(pool, tenantId);
  if (row) tenantCacheSet(row);
  return row;
}

/** Public GET /tenant — permission-filtered settings shape. */
export async function getTenantForApi(): Promise<TenantResponse> {
  const ctx = getContext();
  const row = await tenantRepo.findTenantById(pool, ctx.tenantId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Tenant not found");
  const full = hasPermission("tenancy.settings.view") || ctx.permissions.has("*");
  const base = resolveTenantSettings((row.settings ?? {}) as Record<string, unknown>, row.name);
  if (full) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      settings: base,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
  const brandingOnly: TenantSettingsResolved = {
    default_timezone: base.default_timezone,
    default_currency: base.default_currency,
    date_format: base.date_format,
    time_format: base.time_format,
    branding: base.branding,
    password_policy: base.password_policy,
    features: {},
  };
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    settings: brandingOnly,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateTenantForApi(body: Record<string, unknown>): Promise<TenantResponse> {
  const ctx = getContext();
  const row = await tenantRepo.findTenantById(pool, ctx.tenantId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Tenant not found");

  const prevName = row.name;
  const prevSettings = { ...(row.settings as Record<string, unknown>) };
  let name = row.name;
  if (body.name !== undefined) {
    const n = String(body.name ?? "").trim();
    if (!n || n.length > 100) throw new HttpError(400, "VALIDATION", "Invalid name", "name");
    name = n;
  }

  let nextSettings = (row.settings ?? {}) as Record<string, unknown>;
  if (body.settings !== undefined) {
    let partial: Record<string, unknown>;
    try {
      partial = parsePartialTenantSettings(body.settings);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid settings";
      throw new HttpError(400, "VALIDATION", msg, "settings");
    }
    nextSettings = mergeSettingsJson(nextSettings, partial);
  }

  const updated = await tenantRepo.updateTenant(pool, ctx.tenantId, {
    name: body.name !== undefined ? name : undefined,
    settings: body.settings !== undefined ? nextSettings : undefined,
  });
  if (!updated) throw new HttpError(404, "NOT_FOUND", "Tenant not found");

  tenantCacheInvalidate(ctx.tenantId);
  tenantCacheSet(updated);

  const changed: string[] = [];
  if (body.name !== undefined && name !== prevName) changed.push("name");
  if (body.settings !== undefined) changed.push("settings");

  emitTenantConfigUpdated({
    tenant_id: ctx.tenantId,
    changed_fields: changed,
    previous_values: { name: prevName, settings: prevSettings },
    new_values: { name: updated.name, settings: updated.settings },
    updated_by: ctx.userId,
    updated_at: updated.updated_at,
  });

  return getTenantForApi();
}

function parseIsActiveFilter(q: Record<string, string | undefined>): deptRepo.ListDepartmentsFilters {
  const raw = q.is_active;
  if (raw === undefined || raw === "") return "active_only";
  if (raw === "false" || raw === "0") return "all";
  return "active_only";
}

export async function listDepartmentsApi(
  query: Record<string, string | undefined>,
): Promise<{ data: DepartmentResponse[]; total_count: number }> {
  const ctx = getContext();
  const include =
    query.include_counts === "true" || query.include_counts === "1";
  const filter = parseIsActiveFilter(query);
  const data = await deptRepo.listDepartments(pool, ctx.tenantId, filter, include);
  return { data, total_count: data.length };
}

export async function createDepartmentApi(body: Record<string, unknown>): Promise<DepartmentResponse> {
  const ctx = getContext();
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 100) throw new HttpError(400, "VALIDATION", "Invalid name", "name");
  const head_id = body.head_id ? String(body.head_id) : null;
  if (head_id) {
    const hp = await pRepo.findPersonnelById(pool, ctx.tenantId, head_id, true);
    if (!hp) throw new HttpError(400, "VALIDATION", "head_id not found", "head_id");
  }
  const sortOrder =
    body.sort_order !== undefined && body.sort_order !== null
      ? Number(body.sort_order)
      : await deptRepo.nextDepartmentSortOrder(pool, ctx.tenantId);
  if (Number.isNaN(sortOrder)) throw new HttpError(400, "VALIDATION", "Invalid sort_order", "sort_order");
  const is_active =
    body.is_active === undefined ? true : Boolean(body.is_active);

  const id = randomUUID();
  try {
    const row = await deptRepo.insertDepartment(pool, {
      id,
      tenant_id: ctx.tenantId,
      name,
      description: body.description === undefined ? null : String(body.description),
      head_id,
      color: body.color === undefined ? null : String(body.color),
      sort_order: sortOrder,
      is_active,
    });

    emitDepartmentCreated({
      department_id: id,
      tenant_id: ctx.tenantId,
      name,
      sort_order: sortOrder,
      created_by: ctx.userId,
      created_at: row.created_at,
    });

    return row;
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw new HttpError(409, "CONFLICT", "Department name already exists within tenant", "name");
    }
    throw e;
  }
}

function isPgUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505");
}

export async function getDepartmentApi(id: string): Promise<DepartmentResponse> {
  const ctx = getContext();
  const d = await deptRepo.findDepartmentById(pool, ctx.tenantId, id, true);
  if (!d) throw new HttpError(404, "NOT_FOUND", "Department not found");
  return d;
}

export async function updateDepartmentApi(
  id: string,
  body: Record<string, unknown>,
): Promise<DepartmentResponse> {
  const ctx = getContext();
  const existing = await deptRepo.findDepartmentById(pool, ctx.tenantId, id, false);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Department not found");
  if (body.head_id !== undefined && body.head_id !== null) {
    const hp = await pRepo.findPersonnelById(pool, ctx.tenantId, String(body.head_id), true);
    if (!hp) throw new HttpError(400, "VALIDATION", "head_id not found", "head_id");
  }
  const patch: Parameters<typeof deptRepo.updateDepartment>[3] = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.description !== undefined) patch.description = body.description;
  if (body.head_id !== undefined) patch.head_id = body.head_id;
  if (body.color !== undefined) patch.color = body.color;
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  try {
    const updated = await deptRepo.updateDepartment(pool, ctx.tenantId, id, patch);
    if (!updated) throw new HttpError(404, "NOT_FOUND", "Department not found");

    emitDepartmentUpdated({
      department_id: id,
      tenant_id: ctx.tenantId,
      changed_fields: Object.keys(patch),
      previous_values: existing as unknown as Record<string, unknown>,
      new_values: updated as unknown as Record<string, unknown>,
      updated_by: ctx.userId,
      updated_at: updated.updated_at,
    });

    return updated;
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      throw new HttpError(409, "CONFLICT", "Department name already exists within tenant", "name");
    }
    throw e;
  }
}

export async function deleteDepartmentApi(id: string): Promise<{ id: string; deleted_at: string }> {
  const ctx = getContext();
  const n = await deptRepo.countPersonnelInDepartment(pool, ctx.tenantId, id);
  const a = await deptRepo.countCrewAssignmentsForDepartment(pool, ctx.tenantId, id);
  const blocking = n + a;
  if (blocking > 0) {
    throw new HttpError(409, "CONFLICT", "Department has active personnel or assignments", undefined, {
      blocking_references_count: blocking,
    });
  }
  const before = await deptRepo.findDepartmentById(pool, ctx.tenantId, id, false);
  const deptName = before?.name ?? "";
  const out = await deptRepo.softDeleteDepartment(pool, ctx.tenantId, id);
  if (!out) throw new HttpError(404, "NOT_FOUND", "Department not found");

  emitDepartmentDeleted({
    department_id: id,
    tenant_id: ctx.tenantId,
    name: deptName,
    deleted_by: ctx.userId,
    deleted_at: out.deleted_at,
  });

  return { id: out.id, deleted_at: out.deleted_at };
}

export async function reorderDepartmentsApi(orderedIds: string[]): Promise<void> {
  const ctx = getContext();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new HttpError(400, "VALIDATION", "ordered_ids must be a non-empty array", "ordered_ids");
  }
  const existing = await deptRepo.listDepartments(pool, ctx.tenantId, "all", false);
  const idSet = new Set(existing.map((d) => d.id));
  for (const id of orderedIds) {
    if (!idSet.has(id)) {
      throw new HttpError(400, "VALIDATION", "Unknown department id in list", "ordered_ids");
    }
  }
  await deptRepo.reorderDepartments(pool, ctx.tenantId, orderedIds);
  emitDepartmentReordered({
    tenant_id: ctx.tenantId,
    ordered_ids: orderedIds,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });
}
