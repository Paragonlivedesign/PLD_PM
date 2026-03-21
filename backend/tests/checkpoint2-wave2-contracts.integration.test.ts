/**
 * Checkpoint 2 Category A — Wave 2 modules (scheduling, travel, financial, documents/templates).
 * Mirrors CP1: supertest + buildApp, Postgres via ensureSchema.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { v7 as uuidv7 } from "uuid";
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
    await pool.query("SELECT 1 FROM events LIMIT 1");
    return true;
  } catch {
    /* apply migrations */
  }
  try {
    for (const f of sortedMigrationFiles()) {
      const sql = readFileSync(path.join(migrationsDir, f), "utf8");
      await pool.query(sql);
    }
    await pool.query("SELECT 1 FROM events LIMIT 1");
    return true;
  } catch (e) {
    console.warn("checkpoint2-wave2: DB unavailable:", e);
    return false;
  }
}

function ctxHeaders(tenantId: string, userId: string) {
  return { "X-Tenant-Id": tenantId, "X-User-Id": userId };
}

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

describe("Checkpoint 2 — Wave 2 contract slice (API)", () => {
  let okDb = false;
  const app = buildApp();

  beforeAll(async () => {
    okDb = await ensureSchema();
    if (process.env.CI === "true" && !okDb) {
      throw new Error("Checkpoint 2 wave-2 tests require Postgres in CI.");
    }
  });

  it("scheduling: POST crew assignment + GET list; conflicts GET", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantId, userId))
      .send({ name: `CP2 W2 Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);
    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantId, userId))
      .send({
        name: `CP2 W2 Event ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2026-04-01",
        end_date: "2026-04-03",
      });
    expect(ev.status).toBe(201);

    const p = await request(app)
      .post("/api/v1/personnel")
      .set(apiHeaders(tenantId, userId))
      .send({
        first_name: "W2",
        last_name: "Crew",
        email: `w2-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    expect(p.status).toBe(201);

    const asg = await request(app)
      .post("/api/v1/assignments/crew")
      .set(apiHeaders(tenantId, userId))
      .send({
        event_id: ev.body.data.id,
        personnel_id: p.body.data.id,
        role: "FOH",
        start_date: "2026-04-01",
        end_date: "2026-04-03",
        status: "tentative",
      });
    expect(asg.status).toBe(201);

    const list = await request(app)
      .get("/api/v1/assignments/crew")
      .query({ event_id: ev.body.data.id, limit: 10 })
      .set(apiHeaders(tenantId, userId));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    const conf = await request(app)
      .get("/api/v1/conflicts")
      .query({ limit: 10 })
      .set(apiHeaders(tenantId, userId));
    expect(conf.status).toBe(200);
  });

  it("travel: POST record + GET by id", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantId, userId))
      .send({ name: `CP2 Travel Client ${uuidv7().slice(0, 8)}` });
    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantId, userId))
      .send({
        name: `CP2 Travel Ev ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2026-05-01",
        end_date: "2026-05-04",
      });
    const p = await request(app)
      .post("/api/v1/personnel")
      .set(apiHeaders(tenantId, userId))
      .send({
        first_name: "Fly",
        last_name: "Person",
        email: `fly-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });

    const tr = await request(app)
      .post("/api/v1/travel")
      .set(apiHeaders(tenantId, userId))
      .send({
        event_id: ev.body.data.id,
        personnel_id: p.body.data.id,
        travel_type: "flight",
        direction: "outbound",
        departure_location: "LAX",
        arrival_location: "JFK",
        departure_datetime: "2026-04-30T10:00:00Z",
        arrival_datetime: "2026-04-30T18:00:00Z",
        cost: 350,
        currency: "USD",
        status: "booked",
      });
    expect(tr.status).toBe(201);
    const tid = tr.body.data.id as string;

    const get = await request(app)
      .get(`/api/v1/travel/${tid}`)
      .set(apiHeaders(tenantId, userId));
    expect(get.status).toBe(200);
  });

  it("financial: POST record + GET event budget", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantId, userId))
      .send({ name: `CP2 Fin Client ${uuidv7().slice(0, 8)}` });
    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantId, userId))
      .send({
        name: `CP2 Fin Ev ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2026-06-01",
        end_date: "2026-06-02",
      });

    const fin = await request(app)
      .post("/api/v1/financials")
      .set(apiHeaders(tenantId, userId))
      .send({
        event_id: ev.body.data.id,
        category: "labor",
        type: "cost",
        description: "CP2 test line",
        amount: 1250,
        currency: "USD",
        source: "manual",
      });
    expect(fin.status).toBe(201);

    const bud = await request(app)
      .get(`/api/v1/events/${ev.body.data.id}/budget`)
      .set(apiHeaders(tenantId, userId));
    expect(bud.status).toBe(200);
    expect(bud.body.data).toBeDefined();
  });

  it("documents: list templates + create template + list documents", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    const listT = await request(app)
      .get("/api/v1/templates")
      .set(apiHeaders(tenantId, userId));
    expect(listT.status).toBe(200);

    const createT = await request(app)
      .post("/api/v1/templates")
      .set(apiHeaders(tenantId, userId))
      .send({
        name: `CP2 Tpl ${uuidv7().slice(0, 8)}`,
        category: "other",
        content: "<p>Hello {{event.name}}</p>",
        format: "html",
        default_output_format: "html",
      });
    expect(createT.status).toBe(201);

    const docs = await request(app)
      .get("/api/v1/documents")
      .query({ limit: 5 })
      .set(apiHeaders(tenantId, userId));
    expect(docs.status).toBe(200);
  });
});
