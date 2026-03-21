/**
 * Idempotent Postgres seed for local dev (Phase 0 scope §5).
 * Run after: `docker compose up -d postgres` and `npm run db:migrate`
 * Usage: `npm run db:seed`
 *
 * Operational demo data lives in `seed-demo-catalog.mjs` (and `seed-document-templates.mjs`)
 * — shared with POST /api/v1/tenant/seed-demo. After seed, search index is rebuilt when
 * `backend/dist` is built.
 *
 * Dev bootstrap owner (see docs/bootstrap-dev-identity.md): set `OWNER_EMAIL` or
 * `PLD_DEV_OWNER_EMAIL` in `.env` (preferred for forks). Default matches the doc.
 * Password for seeded users is `pld` (bcrypt hash below — dev only).
 *
 * After catalog seed, applies `018_dev_auth_fixtures.sql` and `019_tasks_rbac_expand.sql`
 * (dev login buffet + tasks RBAC — keep in sync with migrations).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seedDemoCatalog } from "./seed-demo-catalog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const DEMO_ADMIN_ROLE = "10000000-0000-0000-0000-000000000001";
/** Same bcrypt as migration 009 / test user — password `pld` */
const BCRYPT_PLD =
  "$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC";
const OWNER_USER_ID = "00000000-0000-0000-0000-000000000014";

async function main() {
  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query(
      `INSERT INTO tenants (id, slug, name, status, settings)
       VALUES ($1, 'demo', 'Demo Tenant', 'active', '{}')
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_TENANT],
    );

    const ownerEmail = String(
      process.env.PLD_DEV_OWNER_EMAIL ||
        process.env.OWNER_EMAIL ||
        "cody@paragonlivedesign.com",
    )
      .trim()
      .toLowerCase();
    await pool.query(
      `INSERT INTO users (
         id, tenant_id, email, password_hash, role_id,
         first_name, last_name, is_active
       )
       SELECT $1::uuid, $2::uuid, $3::varchar, $4::text, $5::uuid, $6::varchar, $7::varchar, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM users u
         WHERE u.tenant_id = $2::uuid AND lower(u.email) = lower($3::varchar) AND u.deleted_at IS NULL
       )`,
      [
        OWNER_USER_ID,
        DEMO_TENANT,
        ownerEmail,
        BCRYPT_PLD,
        DEMO_ADMIN_ROLE,
        "Owner",
        "User",
      ],
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedDemoCatalog(client, DEMO_TENANT);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    try {
      const { syncSearchIndexForTenant } = await import("../backend/dist/modules/search/service.js");
      await syncSearchIndexForTenant(pool, DEMO_TENANT);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[db:seed] Search index sync skipped:", msg);
    }

    const m018 = path.join(__dirname, "../database/migrations/018_dev_auth_fixtures.sql");
    if (fs.existsSync(m018)) {
      await pool.query(fs.readFileSync(m018, "utf8"));
    }
    const m019 = path.join(__dirname, "../database/migrations/019_tasks_rbac_expand.sql");
    if (fs.existsSync(m019)) {
      await pool.query(fs.readFileSync(m019, "utf8"));
    }

    console.log("Postgres seed complete (idempotent).");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
