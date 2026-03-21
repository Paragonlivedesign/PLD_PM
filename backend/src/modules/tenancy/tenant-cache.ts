import type { TenantRow } from "./types.js";

type CacheEntry = { row: TenantRow; expiresAt: number };

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, CacheEntry>();

export function tenantCacheGet(id: string): TenantRow | null {
  const e = store.get(id);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(id);
    return null;
  }
  return e.row;
}

export function tenantCacheSet(row: TenantRow): void {
  store.set(row.id, { row, expiresAt: Date.now() + TTL_MS });
}

export function tenantCacheInvalidate(id: string): void {
  store.delete(id);
}
