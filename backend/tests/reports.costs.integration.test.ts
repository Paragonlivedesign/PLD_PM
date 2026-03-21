/**
 * Cost report HTTP — permission gate and grouped response shape.
 * Requires Postgres (financial_records). Skips if table missing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

function ctxHeaders(tenantId: string, userId: string) {
  return { "X-Tenant-Id": tenantId, "X-User-Id": userId };
}

function apiHeaders(tenantId: string, userId: string, permissions: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": permissions,
  };
}

describe("GET /api/v1/reports/costs", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    process.env.PLD_SKIP_TENANT_RESOLUTION = "1";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const t = await pool.query(`SELECT to_regclass('public.financial_records') AS x`);
      if (!t.rows[0]?.x) skip = true;
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("returns 403 when permissions omit reports:read", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const r = await request(app)
      .get("/api/v1/reports/costs")
      .query({
        group_by: "category",
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
      })
      .set(apiHeaders(tenantId, userId, "events:read"));
    expect(r.status).toBe(403);
    expect(r.body.errors?.[0]?.code).toBe("FORBIDDEN");
  });

  it("returns 200 with groups when user has only reports:read and costs exist", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    const seedPerms = "clients:create,events:create";
    const c = await request(app)
      .post("/api/v1/clients")
      .set(apiHeaders(tenantId, userId, seedPerms))
      .send({ name: `Reports Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);

    const ev = await request(app)
      .post("/api/v1/events")
      .set(apiHeaders(tenantId, userId, seedPerms))
      .send({
        name: `Reports Event ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2026-10-01",
        end_date: "2026-10-03",
      });
    expect(ev.status).toBe(201);
    const eventId = ev.body.data.id as string;

    const fin = await request(app)
      .post("/api/v1/financials")
      .set(apiHeaders(tenantId, userId, "financials:create"))
      .send({
        event_id: eventId,
        category: "labor",
        type: "cost",
        description: "Cost report seed row",
        amount: 500,
        currency: "USD",
        source: "manual",
        date: "2026-10-15",
      });
    expect(fin.status).toBe(201);

    const rep = await request(app)
      .get("/api/v1/reports/costs")
      .query({
        group_by: "category",
        date_range_start: "2026-01-01",
        date_range_end: "2026-12-31",
      })
      .set(apiHeaders(tenantId, userId, "reports:read"));

    expect(rep.status).toBe(200);
    expect(rep.body.data).toBeDefined();
    expect(rep.body.data.group_by).toBe("category");
    expect(Array.isArray(rep.body.data.groups)).toBe(true);
    const labor = rep.body.data.groups.find((g: { key?: string }) => g.key === "labor");
    expect(labor).toBeDefined();
    expect(Number(labor.total_costs)).toBeGreaterThanOrEqual(500);
    expect(rep.body.data.totals).toBeDefined();
    expect(Number(rep.body.data.totals.total_costs)).toBeGreaterThanOrEqual(500);
  });
});
