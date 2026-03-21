/**
 * Audit logs API + DB (Phase 0 scope §10).
 * Requires Postgres with migrations including 006_audit_logs.sql.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";
import { pool } from "../src/db/pool.js";

/** Seeded in 005_auth_module.sql — matches local dev DB after migrate */
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const DEMO_USER = "00000000-0000-0000-0000-000000000002";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function sortedMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function ensureSchema(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM audit_logs LIMIT 1");
    return true;
  } catch {
    /* apply migrations */
  }
  try {
    for (const f of sortedMigrationFiles()) {
      const sql = readFileSync(path.join(migrationsDir, f), "utf8");
      await pool.query(sql);
    }
    await pool.query("SELECT 1 FROM audit_logs LIMIT 1");
    return true;
  } catch (e) {
    console.warn("audit.integration: DB unavailable or migration failed:", e);
    return false;
  }
}

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "audit:read,events:create,events:read,clients:create",
  };
}

describe("audit logs (API)", () => {
  const app = buildApp();
  let okDb = false;

  beforeAll(async () => {
    okDb = await ensureSchema();
  });

  afterAll(async () => {
    /* pool shared */
  });

  it("lists audit entries after event create", async () => {
    if (!okDb) return;
    const h = apiHeaders(DEMO_TENANT, DEMO_USER);

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: `Audit Client ${uuidv7().slice(0, 8)}` });
    expect(cl.status).toBe(201);

    const ev = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: `Audit Ev ${uuidv7().slice(0, 8)}`,
        client_id: cl.body.data.id,
        start_date: "2028-01-01",
        end_date: "2028-01-03",
      });
    expect(ev.status).toBe(201);
    const eventId = ev.body.data.id as string;

    const list = await request(app).get("/api/v1/audit-logs").query({ entity_id: eventId }).set(h);
    expect(list.status).toBe(200);
    const rows = list.body.data as { action: string; entity_type: string }[];
    expect(rows.some((r) => r.entity_type === "event" && r.action === "create")).toBe(true);
  });
});
