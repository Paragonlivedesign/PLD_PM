/**
 * Explicit tenant isolation for Travel GET and unified Search (PLD_PM).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";
import { syncSearchIndexForTenant } from "../src/modules/search/service.js";

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

function ctxHeaders(tenantId: string, userId: string) {
  return { "X-Tenant-Id": tenantId, "X-User-Id": userId };
}

describe("travel + search tenant isolation", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      const tr = await pool.query(`SELECT to_regclass('public.travel_records') AS t`);
      const si = await pool.query(`SELECT to_regclass('public.search_index') AS t`);
      if (!tr.rows[0]?.t || !si.rows[0]?.t) skip = true;
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("GET /api/v1/travel/:id returns 404 for another tenant", async () => {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const userId = uuidv7();

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantA, userId))
      .send({ name: `IsoTr Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);

    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantA, userId))
      .send({
        name: `IsoTr Ev ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2026-11-01",
        end_date: "2026-11-03",
      });
    expect(ev.status).toBe(201);

    const p = await request(app)
      .post("/api/v1/personnel")
      .set(apiHeaders(tenantA, userId))
      .send({
        first_name: "Iso",
        last_name: "Travel",
        email: `iso-tr-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    expect(p.status).toBe(201);

    const tr = await request(app)
      .post("/api/v1/travel")
      .set(apiHeaders(tenantA, userId))
      .send({
        event_id: ev.body.data.id,
        personnel_id: p.body.data.id,
        travel_type: "flight",
        direction: "outbound",
        departure_location: "SEA",
        arrival_location: "ORD",
        departure_datetime: "2026-10-30T10:00:00Z",
        arrival_datetime: "2026-10-30T16:00:00Z",
        cost: 400,
        currency: "USD",
        status: "booked",
      });
    expect(tr.status).toBe(201);
    const tid = tr.body.data.id as string;

    const wrong = await request(app)
      .get(`/api/v1/travel/${tid}`)
      .set(apiHeaders(tenantB, userId));
    expect(wrong.status).toBe(404);
  });

  it("GET /api/v1/search does not return other tenant events", async () => {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const userId = uuidv7();
    const token = `IsoSearch${uuidv7().replace(/-/g, "").slice(0, 16)}`;

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantA, userId))
      .send({ name: `IsoS Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);

    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantA, userId))
      .send({
        name: `${token} Event`,
        client_id: c.body.data.id,
        start_date: "2026-12-01",
        end_date: "2026-12-02",
      });
    expect(ev.status).toBe(201);
    const eventId = ev.body.data.id as string;

    await syncSearchIndexForTenant(pool, tenantA);

    const res = await request(app)
      .get("/api/v1/search")
      .query({ q: token, type: "events", limit: 10 })
      .set(apiHeaders(tenantB, userId));
    expect(res.status).toBe(200);
    const events = (res.body.data?.results?.events ?? []) as { entity_id: string }[];
    const ids = events.map((e) => e.entity_id);
    expect(ids).not.toContain(eventId);
    expect(res.body.meta?.total_counts?.events ?? 0).toBe(0);
  });
});
