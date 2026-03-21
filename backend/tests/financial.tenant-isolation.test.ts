/**
 * Financial HTTP — cross-tenant access must not leak event-scoped or record-scoped data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";

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

describe("financial tenant isolation (HTTP)", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    /** Random tenant UUIDs have no `tenants` row; match `backend/vitest.config.ts` when Vitest is run from repo root. */
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

  it("cross-tenant cannot GET budget, list event financials, POST financial for event, or GET record by id", async () => {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const userId = uuidv7();

    const c = await request(app)
      .post("/api/v1/clients")
      .set(ctxHeaders(tenantA, userId))
      .send({ name: `FinIso Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);

    const ev = await request(app)
      .post("/api/v1/events")
      .set(ctxHeaders(tenantA, userId))
      .send({
        name: `FinIso Ev ${uuidv7().slice(0, 8)}`,
        client_id: c.body.data.id,
        start_date: "2027-01-01",
        end_date: "2027-01-03",
      });
    expect(ev.status).toBe(201);
    const eventId = ev.body.data.id as string;

    const budB = await request(app)
      .get(`/api/v1/events/${eventId}/budget`)
      .set(apiHeaders(tenantB, userId));
    expect(budB.status).toBe(404);

    const listB = await request(app)
      .get(`/api/v1/events/${eventId}/financials`)
      .query({ limit: 10 })
      .set(apiHeaders(tenantB, userId));
    expect(listB.status).toBe(404);

    const postB = await request(app)
      .post("/api/v1/financials")
      .set(apiHeaders(tenantB, userId))
      .send({
        event_id: eventId,
        category: "labor",
        type: "cost",
        description: "cross-tenant",
        amount: 100,
        currency: "USD",
        source: "manual",
      });
    expect(postB.status).toBe(404);

    const finA = await request(app)
      .post("/api/v1/financials")
      .set(apiHeaders(tenantA, userId))
      .send({
        event_id: eventId,
        category: "labor",
        type: "cost",
        description: "tenant A only",
        amount: 250,
        currency: "USD",
        source: "manual",
      });
    expect(finA.status).toBe(201);
    const finId = finA.body.data.id as string;

    const getB = await request(app)
      .get(`/api/v1/financials/${finId}`)
      .set(apiHeaders(tenantB, userId));
    expect(getB.status).toBe(404);
  });
});
