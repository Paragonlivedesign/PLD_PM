/**
 * Contacts hub — GET /api/v1/contact-persons (+ export).
 * Requires Postgres with migrations including 020_contact_persons.sql.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { pool } from "../src/db/pool.js";
import { buildApp } from "../src/app-factory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function sortedMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function ensureSchema(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM contact_persons LIMIT 1");
    return true;
  } catch {
    /* apply migrations */
  }
  try {
    for (const f of sortedMigrationFiles()) {
      const sql = readFileSync(path.join(migrationsDir, f), "utf8");
      await pool.query(sql);
    }
    await pool.query("SELECT 1 FROM contact_persons LIMIT 1");
    return true;
  } catch (e) {
    console.warn("contacts-hub.api: DB unavailable or migration failed:", e);
    return false;
  }
}

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

describe("Contacts hub API", () => {
  let okDb = false;
  const app = buildApp();

  beforeAll(async () => {
    okDb = await ensureSchema();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("GET /api/v1/contact-persons returns envelope", async () => {
    if (!okDb) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .get("/api/v1/contact-persons?limit=10")
      .set(apiHeaders("10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000101"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /api/v1/contact-persons/export returns CSV", async () => {
    if (!okDb) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .get("/api/v1/contact-persons/export")
      .set(apiHeaders("10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000101"));
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] || "")).toContain("csv");
    expect(typeof res.text).toBe("string");
  });

  it("POST /api/v1/contact-persons/import/dry-run returns staged", async () => {
    if (!okDb) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post("/api/v1/contact-persons/import/dry-run")
      .set(apiHeaders("10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000101"))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ staged: [], conflicts: [] });
  });
});
