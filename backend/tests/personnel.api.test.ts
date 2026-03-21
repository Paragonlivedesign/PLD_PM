import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";
import * as pRepo from "../src/modules/personnel/personnel.repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

const TENANT = "00000000-0000-0000-0000-000000000001";
const TENANT_OTHER = "00000000-0000-0000-0000-000000000099";
const USER = "00000000-0000-0000-0000-000000000002";
const headers = {
  "X-Tenant-Id": TENANT,
  "X-User-Id": USER,
  "X-Permissions": "*",
};
const headersOtherTenant = {
  "X-Tenant-Id": TENANT_OTHER,
  "X-User-Id": USER,
  "X-Permissions": "*",
};

describe("personnel HTTP API", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    const conn = process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const check = await pool.query(`SELECT to_regclass('public.personnel') AS t`);
      if (!check.rows[0]?.t) {
        await pool.query(readMigration("001_init_events_clients_venues.sql"));
        await pool.query(readMigration("002_personnel_departments_invitations.sql"));
      }
      const authTbl = await pool.query(`SELECT to_regclass('public.users') AS t`);
      if (!authTbl.rows[0]?.t) {
        await pool.query(readMigration("005_auth_module.sql"));
      }
      const tenants = await pool.query(`SELECT to_regclass('public.tenants') AS t`);
      if (!tenants.rows[0]?.t) {
        await pool.query(readMigration("005_tenancy.sql"));
      }
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data?.ok).toBe(true);
  });

  it("GET /api/v1/personnel/:id returns 404 for another tenant (HTTP isolation)", async () => {
    if (skip) return;
    const email = `tenant-iso-${uuidv7()}@example.com`;
    const create = await request(app)
      .post("/api/v1/personnel")
      .set(headers)
      .send({
        first_name: "Iso",
        last_name: "Test",
        email,
        role: "Engineer",
        employment_type: "freelance",
      });
    expect(create.status).toBe(201);
    const id = create.body.data?.id as string;
    const leak = await request(app).get(`/api/v1/personnel/${id}`).set(headersOtherTenant);
    expect(leak.status).toBe(404);
    const row = await pRepo.findPersonnelByEmail(pool, TENANT, email);
    if (row) {
      await pool.query(`DELETE FROM personnel WHERE tenant_id = $1 AND id = $2`, [TENANT, row.id]);
    }
  });

  it("personnel CRUD + version + bulk availability + import (Postgres)", async () => {
    if (skip) return;
    const email = `api-test-${uuidv7()}@example.com`;
    const create = await request(app)
      .post("/api/v1/personnel")
      .set(headers)
      .send({
        first_name: "Api",
        last_name: "Test",
        email,
        role: "Engineer",
        employment_type: "freelance",
        day_rate: 400,
      });
    expect(create.status).toBe(201);
    expect(create.body.data?.version).toBe(1);
    const id = create.body.data?.id as string;
    expect(id).toBeTruthy();

    const getOne = await request(app).get(`/api/v1/personnel/${id}`).set(headers);
    expect(getOne.status).toBe(200);
    expect(getOne.body.data?.version).toBe(1);

    const badVer = await request(app)
      .put(`/api/v1/personnel/${id}`)
      .set(headers)
      .send({ version: 99, role: "Lead" });
    expect(badVer.status).toBe(409);

    const okPut = await request(app)
      .put(`/api/v1/personnel/${id}`)
      .set(headers)
      .send({ version: 1, role: "Lead" });
    expect(okPut.status).toBe(200);
    expect(okPut.body.data?.role).toBe("Lead");
    expect(okPut.body.data?.version).toBe(2);

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = start;
    const bulk = await request(app)
      .get(`/api/v1/personnel/availability`)
      .set(headers)
      .query({ start, end, limit: "5" });
    expect(bulk.status).toBe(200);
    expect(Array.isArray(bulk.body.data)).toBe(true);
    expect(bulk.body.meta?.range?.start).toBe(start);

    const importEmail = `import-${uuidv7()}@ex.com`;
    const csv = `first_name,last_name,email,role\nImp,${uuidv7().slice(0, 8)},${importEmail},Stagehand`;
    const up = await request(app).post("/api/v1/personnel/import/upload").set(headers).send({ csv_text: csv });
    expect(up.status).toBe(200);
    const sid = up.body.data?.session_id;
    const map = {
      first_name: "first_name",
      last_name: "last_name",
      email: "email",
      role: "role",
    };
    const val = await request(app)
      .post("/api/v1/personnel/import/validate")
      .set(headers)
      .send({ session_id: sid, column_map: map });
    expect(val.status).toBe(200);
    expect(val.body.data?.valid).toBe(1);

    const prev = await request(app)
      .post("/api/v1/personnel/import/preview")
      .set(headers)
      .send({ session_id: sid, column_map: map });
    expect(prev.status).toBe(200);
    expect(prev.body.data?.new_count).toBe(1);

    const conf = await request(app)
      .post("/api/v1/personnel/import/confirm")
      .set(headers)
      .send({ session_id: sid, column_map: map });
    expect(conf.status).toBe(200);
    expect(conf.body.data?.created).toBe(1);

    for (const em of [email, importEmail]) {
      const row = await pRepo.findPersonnelByEmail(pool, TENANT, em);
      if (row) {
        await pool.query(`DELETE FROM personnel WHERE tenant_id = $1 AND id = $2`, [TENANT, row.id]);
      }
    }
  });
});
