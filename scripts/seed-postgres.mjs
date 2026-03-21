/**
 * Idempotent Postgres seed for local dev (Phase 0 scope §5).
 * Run after: `docker compose up -d postgres` and `npm run db:migrate`
 * Usage: `npm run db:seed`
 *
 * Dev bootstrap owner (see docs/bootstrap-dev-identity.md): set `OWNER_EMAIL` or
 * `PLD_DEV_OWNER_EMAIL` in `.env` (preferred for forks). Default matches the doc.
 * Password for seeded users is `pld` (bcrypt hash below — dev only).
 */
import pg from "pg";

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

    for (let i = 1; i <= 3; i++) {
      const name = `Seed Client ${i}`;
      await pool.query(
        `INSERT INTO clients (id, tenant_id, name, contact_name, metadata)
         SELECT gen_random_uuid(), $1::uuid, $2::varchar, 'Seed'::varchar, '{}'::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM clients c
           WHERE c.tenant_id = $1::uuid AND c.name = $2::varchar AND c.deleted_at IS NULL
         )`,
        [DEMO_TENANT, name],
      );
    }

    for (const [vn, city] of [
      ["Seed Venue A", "Austin"],
      ["Seed Venue B", "Dallas"],
    ]) {
      await pool.query(
        `INSERT INTO venues (id, tenant_id, name, city, address, metadata)
         SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, '1 Demo Road'::varchar, '{}'::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM venues v
           WHERE v.tenant_id = $1::uuid AND v.name = $2::varchar AND v.deleted_at IS NULL
         )`,
        [DEMO_TENANT, vn, city],
      );
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
