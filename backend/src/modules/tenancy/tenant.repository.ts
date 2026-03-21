import type { Pool, PoolClient } from "pg";
import type { TenantRow, TenantStatus } from "./types.js";

export type Db = Pool | PoolClient;

export function mapTenantRow(r: Record<string, unknown>): TenantRow {
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    status: String(r.status) as TenantStatus,
    settings: (r.settings as Record<string, unknown>) ?? {},
    created_at: new Date(String(r.created_at)).toISOString(),
    updated_at: new Date(String(r.updated_at)).toISOString(),
  };
}

export async function findTenantById(db: Db, id: string): Promise<TenantRow | null> {
  const res = await db.query(
    `SELECT id, name, slug, status, settings, created_at, updated_at FROM tenants WHERE id = $1`,
    [id],
  );
  if (res.rows.length === 0) return null;
  return mapTenantRow(res.rows[0] as Record<string, unknown>);
}

export async function updateTenant(
  db: Db,
  id: string,
  patch: { name?: string; settings?: Record<string, unknown> },
): Promise<TenantRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  if (patch.name !== undefined) {
    sets.push(`name = $${n}`);
    vals.push(patch.name);
    n++;
  }
  if (patch.settings !== undefined) {
    sets.push(`settings = $${n}::jsonb`);
    vals.push(JSON.stringify(patch.settings));
    n++;
  }
  if (sets.length === 0) return findTenantById(db, id);
  sets.push("updated_at = NOW()");
  vals.push(id);
  const q = `UPDATE tenants SET ${sets.join(", ")} WHERE id = $${n} RETURNING id, name, slug, status, settings, created_at, updated_at`;
  const res = await db.query(q, vals);
  if (res.rows.length === 0) return null;
  return mapTenantRow(res.rows[0] as Record<string, unknown>);
}
