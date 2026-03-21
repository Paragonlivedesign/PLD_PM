/**
 * Idempotent demo catalog for local/dev — loads SQL from `scripts/seed-demo-catalog.mjs`
 * (same script as `npm run db:seed` after tenant + owner user).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../core/http-error.js";
import { syncSearchIndexForTenant } from "../search/service.js";

export function isTenantDemoSeedAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const v = process.env.PLD_ALLOW_TENANT_DEMO_SEED;
  return v === "1" || v === "true";
}

function resolveSeedDemoCatalogUrl(): string {
  const cwd = process.cwd();
  const candidates = [join(cwd, "scripts", "seed-demo-catalog.mjs"), join(cwd, "..", "scripts", "seed-demo-catalog.mjs")];
  for (const p of candidates) {
    if (existsSync(p)) return pathToFileURL(p).href;
  }
  throw new HttpError(
    500,
    "INTERNAL",
    "Could not find scripts/seed-demo-catalog.mjs (deploy the repo scripts/ folder or run the API from the monorepo root).",
  );
}

export async function seedTenantDemoOperationalData(tenantId: string): Promise<{ seeded: true }> {
  if (!isTenantDemoSeedAllowed()) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Demo seed is disabled. Set PLD_ALLOW_TENANT_DEMO_SEED=1 in production or use a non-production NODE_ENV.",
    );
  }

  const mod = await import(resolveSeedDemoCatalogUrl());
  const seedDemoCatalog = mod.seedDemoCatalog as (db: import("pg").PoolClient, id: string) => Promise<void>;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await seedDemoCatalog(client, tenantId);
    await client.query("COMMIT");
    try {
      await syncSearchIndexForTenant(pool, tenantId);
    } catch (e) {
      console.warn("[tenant/seed-demo] search index sync failed (data was committed):", e);
    }
    return { seeded: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
