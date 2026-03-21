/**
 * Single Postgres pool — must match `db/pool.ts` (auth + routes use that module).
 * Tenant resolution and tenancy services import from here; previously this file used a
 * different default when DATABASE_URL was unset, causing valid JWTs + TENANT_FORBIDDEN (403).
 */
import type { Pool, PoolClient } from "pg";

export { pool } from "../db/pool.js";

export type DbClient = Pool | PoolClient;
