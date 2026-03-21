/**
 * Apply SQL migrations in database/migrations/ (alphabetical order).
 * Records applied files in schema_migrations so re-runs are safe.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/db-migrate.mjs
 *
 * If the DB was migrated before this tracker existed, the first run detects
 * existing tables and baselines all current .sql filenames without re-running them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "database", "migrations");

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

const pool = new pg.Pool({ connectionString });

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function isApplied(client, filename) {
  const r = await client.query(
    `SELECT 1 FROM schema_migrations WHERE filename = $1`,
    [filename],
  );
  return r.rowCount > 0;
}

async function markApplied(client, filename) {
  await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
}

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT to_regclass($1) AS t`,
    [`public.${name}`],
  );
  return r.rows[0]?.t != null;
}

async function maybeBaselineExistingDb(client) {
  const count = await client.query(`SELECT count(*)::int AS c FROM schema_migrations`);
  const n = count.rows[0]?.c ?? 0;
  if (n > 0) return;

  const hasClients = await tableExists(client, "clients");
  if (!hasClients) return;

  console.log(
    "[db-migrate] Existing tables detected with empty schema_migrations — baselining",
    files.length,
    "migration file(s) without re-running SQL.",
  );
  console.log(
    "[db-migrate] If this DB is wrong, use a fresh database (DROP/CREATE pld_dev) and migrate again.",
  );
  for (const f of files) {
    await markApplied(client, f);
  }
}

/** Baseline can mark 006 as applied before audit_logs existed; unmark so CREATE TABLE runs. */
async function repairMissingAuditLogsMigration(client) {
  if (await tableExists(client, "audit_logs")) return;
  const r = await client.query(`DELETE FROM schema_migrations WHERE filename = $1`, [
    "006_audit_logs.sql",
  ]);
  if ((r.rowCount ?? 0) > 0) {
    console.log(
      "[db-migrate] Repair: audit_logs table missing — removed stale 006 mark; will apply 006_audit_logs.sql.",
    );
  }
}

const client = await pool.connect();
try {
  await ensureMigrationsTable(client);
  await maybeBaselineExistingDb(client);
  await repairMissingAuditLogsMigration(client);

  for (const f of files) {
    if (await isApplied(client, f)) {
      console.log("Skipping (already applied)", f);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    console.log("Applying", f);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await markApplied(client, f);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("Done.");
} finally {
  client.release();
  await pool.end();
}
