import { findTenantById } from "../modules/tenancy/tenant.repository.js";
import { tenantCacheGet, tenantCacheSet } from "../modules/tenancy/tenant-cache.js";
import type { TenantRow } from "../modules/tenancy/types.js";
import { pool } from "../core/database.js";

export async function loadActiveTenantRow(tenantId: string): Promise<TenantRow | null> {
  if (process.env.PLD_SKIP_TENANT_RESOLUTION === "1") {
    return {
      id: tenantId,
      name: "Unknown",
      slug: "unknown",
      status: "active",
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const cached = tenantCacheGet(tenantId);
  if (cached) return cached;
  try {
    const row = await findTenantById(pool, tenantId);
    if (row) tenantCacheSet(row);
    return row;
  } catch {
    return null;
  }
}

export function isTenantUsable(row: TenantRow | null): row is TenantRow {
  return row !== null && row.status === "active";
}
