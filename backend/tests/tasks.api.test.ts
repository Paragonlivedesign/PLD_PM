/**
 * Tasks CRUD (tenant dev headers).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { buildApp } from "../src/app-factory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

describe("tasks HTTP API", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  const tenantId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";
  const headers = {
    "X-Tenant-Id": tenantId,
    "X-User-Id": userId,
    "X-Permissions": "*",
  };

  beforeAll(async () => {
    const conn = process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const t = await pool.query(`SELECT to_regclass('public.tasks') AS x`);
      if (!t.rows[0]?.x) {
        await pool.query(readMigration("001_init_events_clients_venues.sql"));
        await pool.query(readMigration("002_personnel_departments_invitations.sql"));
        await pool.query(readMigration("005_auth_module.sql"));
        await pool.query(readMigration("005_tenancy.sql"));
        await pool.query(readMigration("006_audit_logs.sql"));
        await pool.query(readMigration("017_tasks_module.sql"));
      }
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("POST list GET PATCH DELETE task", async () => {
    if (skip) return;
    const create = await request(app).post("/api/v1/tasks").set(headers).send({
      title: "Vitest task",
      status: "open",
    });
    expect(create.status).toBe(201);
    const id = create.body.data?.id as string;
    expect(id).toBeTruthy();

    const list = await request(app).get("/api/v1/tasks").set(headers).query({ parent_task_id: "root" });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.some((x: { id: string }) => x.id === id)).toBe(true);

    const one = await request(app).get(`/api/v1/tasks/${id}`).set(headers);
    expect(one.status).toBe(200);
    expect(one.body.data.title).toBe("Vitest task");

    const patch = await request(app).patch(`/api/v1/tasks/${id}`).set(headers).send({ status: "done" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe("done");

    const del = await request(app).delete(`/api/v1/tasks/${id}`).set(headers);
    expect(del.status).toBe(200);
  });
});
