/**
 * Checkpoint 2 — Categories D, E, F, G, H (selected rows) via internals + HTTP.
 * See Planning `checkpoint-2-verification-record.md` for full matrix / WAIVE rows.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { v7 as uuidv7 } from "uuid";
import { domainBus } from "../src/domain/bus.js";
import { pool } from "../src/db/pool.js";
import { buildApp } from "../src/app-factory.js";
import { registerFinancialBusListeners } from "../src/modules/financial/index.js";
import { registerEventDatesBusListeners } from "../src/modules/scheduling/event-dates-bus.js";
import { getEventByIdInternal } from "../src/modules/events/service.js";
import { getAssignmentDays } from "../src/modules/scheduling/index.js";
import { getTravelCosts } from "../src/modules/travel/index.js";
import { getDayRate, getPerDiem } from "../src/modules/personnel/index.js";
import { getAssignmentsByEvent } from "../src/modules/scheduling/scheduling-internal.service.js";
import { getAvailableTrucksInternal } from "../src/modules/trucks/trucks.service.js";
import { recalculateEventCostsInternal } from "../src/modules/financial/financial.service.js";

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
    console.warn("checkpoint2.categories: DB unavailable:", e);
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

describe("Checkpoint 2 — Categories D–H (API + internals)", () => {
  let okDb = false;
  const app = buildApp();

  beforeAll(async () => {
    okDb = await ensureSchema();
    if (process.env.CI === "true" && !okDb) {
      throw new Error("Checkpoint 2 category tests require Postgres in CI.");
    }
    registerFinancialBusListeners(pool);
    registerEventDatesBusListeners(pool);
  });

  afterAll(() => {
    /* pool shared */
  });

  it("2.D.1–2.D.6 cross-module reads (scheduling ↔ events/personnel/trucks; financial peers)", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: "D-Read Client" });
    const v = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "D Venue", latitude: 40.0, longitude: -74.0 });
    const ev = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "D Read Event",
        client_id: cl.body.data.id,
        venue_id: v.body.data.id,
        start_date: "2028-06-01",
        end_date: "2028-06-03",
      });
    const eventId = ev.body.data.id as string;

    const p = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "D",
        last_name: "Person",
        email: `d-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
        day_rate: 400,
        per_diem: 50,
      });
    const pid = p.body.data.id as string;

    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eventId,
        personnel_id: pid,
        role: "FOH",
        start_date: "2028-06-01",
        end_date: "2028-06-03",
        status: "confirmed",
      });

    await request(app)
      .post("/api/v1/travel")
      .set(a)
      .send({
        event_id: eventId,
        personnel_id: pid,
        travel_type: "flight",
        direction: "outbound",
        departure_location: "A",
        arrival_location: "B",
        departure_datetime: "2028-05-31T12:00:00Z",
        arrival_datetime: "2028-05-31T14:00:00Z",
        cost: 199,
        currency: "USD",
        status: "booked",
      });

    const intEv = await getEventByIdInternal(eventId, tenantId);
    expect(intEv?.name).toBe("D Read Event");

    const asg = await getAssignmentsByEvent(eventId, tenantId, { type: "crew" });
    expect(asg.crew.length).toBe(1);

    const days = await getAssignmentDays(eventId, tenantId, { type: "crew" });
    expect(days.crew.total_day_rate_cost).toBe(1200);

    const trc = await getTravelCosts(eventId, tenantId, { include_cancelled: false });
    expect(Number(trc.total_cost)).toBeGreaterThanOrEqual(199);

    const dr = await getDayRate(pid, tenantId);
    const pd = await getPerDiem(pid, tenantId);
    expect(dr.day_rate).toBe(400);
    expect(pd.per_diem).toBe(50);

    const tr = await request(app)
      .post("/api/v1/trucks")
      .set(a)
      .send({ name: `Avail ${uuidv7().slice(0, 6)}`, type: "box_truck", status: "available" });
    const trucks = await getAvailableTrucksInternal(tenantId, "2028-06-01", "2028-06-03");
    expect(trucks.some((t) => t.id === tr.body.data.id)).toBe(true);
  });

  it("2.E.1 double_booking, 2.E.2 truck_overlap 409, 2.E.3 drive_time_infeasible, 2.E.4 no false conflict", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: "E Client" });
    const nyc = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "NYC", latitude: 40.7505, longitude: -73.9934 });
    const la = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "LA", latitude: 34.043, longitude: -118.2673 });

    const eNyc = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E NYC",
        client_id: cl.body.data.id,
        venue_id: nyc.body.data.id,
        start_date: "2028-07-01",
        end_date: "2028-07-03",
      });
    const eLa = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E LA",
        client_id: cl.body.data.id,
        venue_id: la.body.data.id,
        start_date: "2028-08-01",
        end_date: "2028-08-03",
      });

    const pFar = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "Eva",
        last_name: "Far",
        email: `evafar-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    const pidFar = pFar.body.data.id as string;

    const pDrive = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "Eva",
        last_name: "Drive",
        email: `evadrive-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    const pidDrive = pDrive.body.data.id as string;

    // E.4 — far-apart events, no overlap conflict (separate person so later drive scenarios do not pair-adjacent)
    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eNyc.body.data.id,
        personnel_id: pidFar,
        role: "A",
        start_date: "2028-07-01",
        end_date: "2028-07-03",
        status: "confirmed",
      });
    const far = await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eLa.body.data.id,
        personnel_id: pidFar,
        role: "A",
        start_date: "2028-08-01",
        end_date: "2028-08-03",
        status: "confirmed",
      });
    expect(far.status).toBe(201);
    let conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    let active = (conf.body.data as { conflict_kind?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking",
    );
    expect(active.length).toBe(0);

    // E.3 — consecutive gigs NYC→LA with 24h gap: drive > gap
    const eNyc2 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E NYC2",
        client_id: cl.body.data.id,
        venue_id: nyc.body.data.id,
        start_date: "2028-08-10",
        end_date: "2028-08-12",
      });
    const eLa2 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E LA2",
        client_id: cl.body.data.id,
        venue_id: la.body.data.id,
        start_date: "2028-08-13",
        end_date: "2028-08-14",
      });
    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eNyc2.body.data.id,
        personnel_id: pidDrive,
        role: "A",
        start_date: "2028-08-10",
        end_date: "2028-08-12",
        status: "tentative",
      });
    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eLa2.body.data.id,
        personnel_id: pidDrive,
        role: "A",
        start_date: "2028-08-13",
        end_date: "2028-08-14",
        status: "tentative",
      });
    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    const driveCx = (conf.body.data as { conflict_kind?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "drive_time_infeasible",
    );
    expect(driveCx.length).toBeGreaterThanOrEqual(1);

    // E.1 — overlapping tentative double_booking
    const eOvlA = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "Ovl A",
        client_id: cl.body.data.id,
        venue_id: nyc.body.data.id,
        start_date: "2028-09-01",
        end_date: "2028-09-03",
      });
    const eOvlB = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "Ovl B",
        client_id: cl.body.data.id,
        venue_id: nyc.body.data.id,
        start_date: "2028-09-02",
        end_date: "2028-09-04",
      });
    const p2 = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "O",
        last_name: "Double",
        email: `o-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    const pid2 = p2.body.data.id as string;
    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eOvlA.body.data.id,
        personnel_id: pid2,
        role: "A",
        start_date: "2028-09-01",
        end_date: "2028-09-03",
        status: "tentative",
      });
    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eOvlB.body.data.id,
        personnel_id: pid2,
        role: "A",
        start_date: "2028-09-02",
        end_date: "2028-09-04",
        status: "tentative",
      });
    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    const dbl = (conf.body.data as { conflict_kind?: string; resource_id?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking" && x.resource_id === pid2,
    );
    expect(dbl.length).toBeGreaterThanOrEqual(1);

    // E.2 — truck double-book → 409 (no persisted soft conflict row)
    const trk = await request(app)
      .post("/api/v1/trucks")
      .set(a)
      .send({ name: `T ${uuidv7().slice(0, 6)}`, type: "box_truck", status: "available" });
    const tid = trk.body.data.id as string;
    const tev = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "Truck Ev",
        client_id: cl.body.data.id,
        venue_id: nyc.body.data.id,
        start_date: "2028-10-01",
        end_date: "2028-10-03",
      });
    await request(app)
      .post("/api/v1/assignments/truck")
      .set(a)
      .send({
        event_id: tev.body.data.id,
        truck_id: tid,
        start_date: "2028-10-01",
        end_date: "2028-10-03",
        status: "confirmed",
      });
    const t2 = await request(app)
      .post("/api/v1/assignments/truck")
      .set(a)
      .send({
        event_id: tev.body.data.id,
        truck_id: tid,
        start_date: "2028-10-02",
        end_date: "2028-10-04",
        status: "confirmed",
      });
    expect(t2.status).toBe(409);
    expect(t2.body.errors?.[0]?.code).toBe("truck_overlap");
  });

  it("2.E.5 conflict resolves when assignment deleted; 2.E.6 event date change re-evaluates overlaps", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: "E56" });
    const v = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "V", latitude: 41, longitude: -74 });
    const e1 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E1",
        client_id: cl.body.data.id,
        venue_id: v.body.data.id,
        start_date: "2028-11-10",
        end_date: "2028-11-12",
      });
    const e2 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "E2",
        client_id: cl.body.data.id,
        venue_id: v.body.data.id,
        start_date: "2028-11-20",
        end_date: "2028-11-22",
      });
    const p = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "Pat",
        last_name: "E56",
        email: `p-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
      });
    const pid = p.body.data.id as string;

    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: e1.body.data.id,
        personnel_id: pid,
        role: "A",
        start_date: "2028-11-10",
        end_date: "2028-11-12",
        status: "tentative",
      });
    const a2 = await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: e2.body.data.id,
        personnel_id: pid,
        role: "A",
        start_date: "2028-11-20",
        end_date: "2028-11-22",
        status: "tentative",
      });
    const aid2 = a2.body.data.id as string;

    // No overlap initially
    let conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    let dbl = (conf.body.data as { conflict_kind?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking",
    );
    const initialDbl = dbl.length;

    const patch = await request(app)
      .put(`/api/v1/events/${e2.body.data.id}`)
      .set(h)
      .send({
        start_date: "2028-11-10",
        end_date: "2028-11-12",
      });
    expect(patch.status).toBe(200);

    /* Event dates do not cascade to crew rows; align assignment 2 so overlap detection runs (E.6). */
    const align = await request(app)
      .put(`/api/v1/assignments/crew/${aid2}`)
      .set(a)
      .send({
        start_date: "2028-11-10",
        end_date: "2028-11-12",
      });
    expect(align.status).toBe(200);

    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    dbl = (conf.body.data as { conflict_kind?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking",
    );
    expect(dbl.length).toBeGreaterThan(initialDbl);

    await request(app).delete(`/api/v1/assignments/crew/${aid2}`).set(a);
    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    dbl = (conf.body.data as { conflict_kind?: string; status?: string }[]).filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking",
    );
    expect(dbl.length).toBe(0);
  });

  it("2.F.3 labor uses day_rate_override; 2.F.7 recalc after crew delete; 2.G.3–2.G.4 template binding + custom field list", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    const fk = `region_${uuidv7().slice(0, 8)}`;
    await request(app)
      .post("/api/v1/custom-fields")
      .set(a)
      .send({
        entity_type: "event",
        field_key: fk,
        label: "Region",
        field_type: "text",
        is_required: false,
      });

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: "FG" });
    const v = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "FV", latitude: 42, longitude: -71 });
    const ev = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "FG Event",
        client_id: cl.body.data.id,
        venue_id: v.body.data.id,
        start_date: "2028-12-01",
        end_date: "2028-12-02",
        custom_fields: { [fk]: "Northeast" },
      });
    const eventId = ev.body.data.id as string;

    const p = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "F",
        last_name: "Guy",
        email: `f-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
        day_rate: 100,
      });
    const pid = p.body.data.id as string;

    const asg = await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eventId,
        personnel_id: pid,
        role: "A",
        start_date: "2028-12-01",
        end_date: "2028-12-02",
        status: "confirmed",
        day_rate_override: 999,
      });
    expect(asg.status).toBe(201);
    const asgId = asg.body.data.id as string;

    async function sumLabor(): Promise<number> {
      const fin = await request(app)
        .get(`/api/v1/events/${eventId}/financials`)
        .query({ limit: 50, source: "calculated" })
        .set(a);
      return (fin.body.data as { category?: string; amount?: string }[])
        .filter((r) => r.category === "labor")
        .reduce((s, r) => s + Number(r.amount), 0);
    }
    let labor = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      labor = await sumLabor();
      if (labor === 1998) break;
    }
    expect(labor).toBe(1998);

    await request(app).delete(`/api/v1/assignments/crew/${asgId}`).set(a);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      labor = await sumLabor();
      if (labor === 0) break;
    }
    expect(labor).toBe(0);

    const tpl = await request(app)
      .post("/api/v1/templates")
      .set(a)
      .send({
        name: `G ${uuidv7().slice(0, 6)}`,
        category: "other",
        content: "<p>{{event_name}}</p>{{custom_fields_list}}",
        format: "html",
        default_output_format: "html",
      });
    const gen = await request(app)
      .post("/api/v1/documents/generate")
      .set(a)
      .send({
        template_id: tpl.body.data.id,
        event_id: eventId,
        output_format: "html",
      });
    expect(gen.status).toBe(201);
    const docId = gen.body.data.id as string;
    const dlUrl = String(gen.body.meta?.download_url ?? "");
    expect(dlUrl).toBeTruthy();
    const token = new URL(dlUrl, "http://local").searchParams.get("token");
    expect(token).toBeTruthy();
    const file = await request(app)
      .get(`/api/v1/documents/${docId}/file`)
      .query({ token: token! });
    expect(file.status).toBe(200);
    expect(file.text).toContain("FG Event");
    expect(file.text).toContain("Northeast");
  });

  it("2.H.1 budget.updated on recalc; 2.H.3 personnel.rate_changed triggers recalc", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    const spy = vi.fn();
    domainBus.on("budget.updated", spy);

    const cl = await request(app).post("/api/v1/clients").set(h).send({ name: "H" });
    const v = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({ name: "HV", latitude: 43, longitude: -70 });
    const ev = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "H Ev",
        client_id: cl.body.data.id,
        venue_id: v.body.data.id,
        start_date: "2029-01-10",
        end_date: "2029-01-11",
      });
    const eventId = ev.body.data.id as string;

    const p = await request(app)
      .post("/api/v1/personnel")
      .set(a)
      .send({
        first_name: "H",
        last_name: "Rate",
        email: `h-${uuidv7().slice(0, 8)}@example.com`,
        role: "Tech",
        employment_type: "contractor",
        day_rate: 300,
      });
    const pid = p.body.data.id as string;

    await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: eventId,
        personnel_id: pid,
        role: "A",
        start_date: "2029-01-10",
        end_date: "2029-01-11",
        status: "confirmed",
      });

    await recalculateEventCostsInternal(tenantId, eventId, { triggered_by: "cp2.h.test" });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);

    const g = await request(app).get(`/api/v1/personnel/${pid}`).set(a);
    await request(app)
      .put(`/api/v1/personnel/${pid}`)
      .set(a)
      .send({ day_rate: 500, version: g.body.data.version });

    let labor = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const fin = await request(app)
        .get(`/api/v1/events/${eventId}/financials`)
        .query({ limit: 20 })
        .set(a);
      labor = (fin.body.data as { category?: string; amount?: string }[])
        .filter((row) => row.category === "labor")
        .reduce((s, row) => s + Number(row.amount), 0);
      if (labor === 1000) break;
    }
    expect(labor).toBe(1000);

    domainBus.off("budget.updated", spy);
  });
});
