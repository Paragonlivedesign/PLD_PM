import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app-factory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

const TENANT_A = "00000000-0000-0000-0000-000000000001";
const USER = "00000000-0000-0000-0000-000000000002";

describe("tenancy isolation (HTTP + Postgres)", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;
  let tenantB = "";
  let deptB = "";

  beforeAll(async () => {
    const conn = process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const check = await pool.query(`SELECT to_regclass('public.personnel') AS t`);
      if (!check.rows[0]?.t) {
        await pool.query(readMigration("001_init_events_clients_venues.sql"));
        await pool.query(readMigration("002_personnel_departments_invitations.sql"));
      }
      const tenants = await pool.query(`SELECT to_regclass('public.tenants') AS t`);
      if (!tenants.rows[0]?.t) {
        await pool.query(readMigration("005_tenancy.sql"));
      }
      tenantB = randomUUID();
      deptB = randomUUID();
      await pool.query(
        `INSERT INTO tenants (id, name, slug, status, settings) VALUES ($1, $2, $3, 'active', '{}')`,
        [tenantB, "Tenant B Org", "tenant-b-" + tenantB.slice(0, 8)],
      );
      await pool.query(
        `INSERT INTO departments (id, tenant_id, name, description, head_id, color, sort_order, is_active)
         VALUES ($1, $2, 'Secret Dept', null, null, null, 0, true)`,
        [deptB, tenantB],
      );
    } catch (e) {
      console.warn("Skipping tenancy isolation tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("GET /api/v1/tenant returns current tenant from headers", async () => {
    if (skip) return;
    const res = await request(app)
      .get("/api/v1/tenant")
      .set({
        "X-Tenant-Id": TENANT_A,
        "X-User-Id": USER,
        "X-Permissions": "*",
      });
    expect(res.status).toBe(200);
    expect(res.body.data?.id).toBe(TENANT_A);
    expect(res.body.data?.slug).toBeTruthy();
  });

  it("GET /api/v1/departments does not leak other-tenant departments", async () => {
    if (skip) return;
    const res = await request(app)
      .get("/api/v1/departments")
      .set({
        "X-Tenant-Id": TENANT_A,
        "X-User-Id": USER,
        "X-Permissions": "*",
      });
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: string }[]).map((d) => d.id);
    expect(ids).not.toContain(deptB);
  });

  it("GET /api/v1/departments/:id returns 404 for other-tenant id", async () => {
    if (skip) return;
    const res = await request(app)
      .get(`/api/v1/departments/${deptB}`)
      .set({
        "X-Tenant-Id": TENANT_A,
        "X-User-Id": USER,
        "X-Permissions": "*",
      });
    expect(res.status).toBe(404);
  });
});
