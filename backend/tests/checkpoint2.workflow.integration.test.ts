/**
 * Checkpoint 2 Category C — 27-step workflow (integration-checkpoints.md § C), API harness.
 * Maps steps to PASS (automated here) or WAIVE (see Planning checkpoint-2-verification-record.md).
 *
 * Registers Financial + event-date listeners like production `index.ts` (tests do not load `index.ts`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { v7 as uuidv7 } from "uuid";
import { pool } from "../src/db/pool.js";
import { buildApp } from "../src/app-factory.js";
import { registerDocumentStaleListeners } from "../src/modules/documents/index.js";
import { registerEventDatesBusListeners } from "../src/modules/scheduling/event-dates-bus.js";
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
    console.warn("checkpoint2.workflow: DB unavailable:", e);
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

describe("Checkpoint 2 — Category C workflow (27-step API slice)", () => {
  let okDb = false;
  const app = buildApp();

  beforeAll(async () => {
    okDb = await ensureSchema();
    if (process.env.CI === "true" && !okDb) {
      throw new Error("Checkpoint 2 workflow tests require Postgres in CI.");
    }
    /* Omit registerFinancialBusListeners: step 16 calls recalculateEventCostsInternal; bus listeners would duplicate labor rows. */
    registerDocumentStaleListeners(pool);
    registerEventDatesBusListeners(pool);
  });

  afterAll(() => {
    /* pool shared */
  });

  it("steps 1–27: client → venues → event → phase → crew → conflict → truck → travel → financial → docs → phases", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const h = ctxHeaders(tenantId, userId);
    const a = apiHeaders(tenantId, userId);

    // Step 1 — client "Acme Corp"
    const c = await request(app).post("/api/v1/clients").set(h).send({ name: "Acme Corp" });
    expect(c.status).toBe(201);
    const clientId = c.body.data.id as string;

    // Step 2 — venues with coordinates (MSG + LA)
    const v1 = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({
        name: "Madison Square Garden",
        city: "New York",
        latitude: 40.7505,
        longitude: -73.9934,
      });
    expect(v1.status).toBe(201);
    const venueNyc = v1.body.data.id as string;

    const v2 = await request(app)
      .post("/api/v1/venues")
      .set(h)
      .send({
        name: "LA Forum",
        city: "Los Angeles",
        latitude: 34.043,
        longitude: -118.2673,
      });
    expect(v2.status).toBe(201);
    const venueLa = v2.body.data.id as string;

    // Step 3 — event Feb 20–22 (use 2028-03-20..22) in planning
    const ev1 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "Acme Annual Conference",
        client_id: clientId,
        venue_id: venueNyc,
        start_date: "2028-03-20",
        end_date: "2028-03-22",
      });
    expect(ev1.status).toBe(201);
    const event1Id = ev1.body.data.id as string;
    expect(ev1.body.data.phase).toBe("planning");

    // Step 4 — transition toward production (planning → pre_production = “Awarded” analog)
    const ph1 = await request(app)
      .put(`/api/v1/events/${event1Id}/phase`)
      .set(h)
      .send({ phase: "pre_production" });
    expect(ph1.status).toBe(200);

    // Step 5 — three personnel with day rates (+ per diem for cost checks)
    async function createPerson(
      first: string,
      last: string,
      dayRate: number,
      perDiem: number,
    ): Promise<string> {
      const p = await request(app)
        .post("/api/v1/personnel")
        .set(a)
        .send({
          first_name: first,
          last_name: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}-${uuidv7().slice(0, 8)}@example.com`,
          role: "Crew",
          employment_type: "contractor",
          day_rate: dayRate,
          per_diem: perDiem,
        });
      expect(p.status).toBe(201);
      return p.body.data.id as string;
    }
    const aliceId = await createPerson("Alice", "Audio", 500, 75);
    const bobId = await createPerson("Bob", "Video", 450, 75);
    const charlieId = await createPerson("Charlie", "Lead", 600, 75);

    // Step 6 — all three on event1 (tentative). Confirmed + overlapping second event returns 409 (`personnel_has_confirmed_overlap`).
    for (const [pid, role] of [
      [aliceId, "Audio Engineer"],
      [bobId, "Video Engineer"],
      [charlieId, "Crew Lead"],
    ] as const) {
      const asg = await request(app)
        .post("/api/v1/assignments/crew")
        .set(a)
        .send({
          event_id: event1Id,
          personnel_id: pid,
          role,
          start_date: "2028-03-20",
          end_date: "2028-03-22",
          status: "tentative",
        });
      expect(asg.status).toBe(201);
    }

    // Step 7 — assignment.created (WAIVE explicit bus count in CP2 supplement test)

    // Step 8 — no conflicts yet
    let conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    expect(conf.status).toBe(200);
    const active0 = (conf.body.data as { status?: string }[]).filter((x) => x.status === "active");
    expect(active0.length).toBe(0);

    // Step 9 — second event different venue Mar 21–23
    const ev2 = await request(app)
      .post("/api/v1/events")
      .set(h)
      .send({
        name: "Acme West Coast",
        client_id: clientId,
        venue_id: venueLa,
        start_date: "2028-03-21",
        end_date: "2028-03-23",
      });
    expect(ev2.status).toBe(201);
    const event2Id = ev2.body.data.id as string;

    // Step 10 — Alice on event2 Mar 21–22 (tentative overlap with event1)
    const alice2 = await request(app)
      .post("/api/v1/assignments/crew")
      .set(a)
      .send({
        event_id: event2Id,
        personnel_id: aliceId,
        role: "Audio Engineer",
        start_date: "2028-03-21",
        end_date: "2028-03-22",
        status: "tentative",
      });
    expect(alice2.status).toBe(201);

    // Step 11 — double-booking conflict
    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    expect(conf.status).toBe(200);
    const rows = conf.body.data as { conflict_kind?: string; resource_id?: string; status?: string }[];
    const dbl = rows.filter(
      (x) => x.status === "active" && x.conflict_kind === "double_booking" && x.resource_id === aliceId,
    );
    expect(dbl.length).toBeGreaterThanOrEqual(1);

    // Step 12 — truck on event 1
    const trk = await request(app)
      .post("/api/v1/trucks")
      .set(a)
      .send({
        name: `CP2 Truck ${uuidv7().slice(0, 6)}`,
        type: "box_truck",
        status: "available",
        daily_rate: 250,
      });
    expect(trk.status).toBe(201);
    const truckId = trk.body.data.id as string;

    const ta = await request(app)
      .post("/api/v1/assignments/truck")
      .set(a)
      .send({
        event_id: event1Id,
        truck_id: truckId,
        start_date: "2028-03-20",
        end_date: "2028-03-22",
        status: "confirmed",
      });
    expect(ta.status).toBe(201);

    // Steps 13–15 — travel (flight + hotels on event1)
    const flight = await request(app)
      .post("/api/v1/travel")
      .set(a)
      .send({
        event_id: event1Id,
        personnel_id: aliceId,
        travel_type: "flight",
        direction: "outbound",
        departure_location: "JFK",
        arrival_location: "LGA",
        departure_datetime: "2028-03-19T14:00:00Z",
        arrival_datetime: "2028-03-19T17:00:00Z",
        cost: 420,
        currency: "USD",
        status: "booked",
      });
    expect(flight.status).toBe(201);

    const hotelAlice = await request(app)
      .post("/api/v1/travel")
      .set(a)
      .send({
        event_id: event1Id,
        personnel_id: aliceId,
        travel_type: "other",
        direction: "outbound",
        departure_location: "Hotel",
        arrival_location: "Hotel",
        departure_datetime: "2028-03-19T15:00:00Z",
        arrival_datetime: "2028-03-22T11:00:00Z",
        cost: 0,
        currency: "USD",
        status: "booked",
        accommodation: {
          hotel_name: "CP2 Inn",
          check_in_date: "2028-03-19",
          check_out_date: "2028-03-22",
          nightly_rate: 200,
          total_cost: 600,
        },
      });
    expect(hotelAlice.status).toBe(201);

    const hotelBob = await request(app)
      .post("/api/v1/travel")
      .set(a)
      .send({
        event_id: event1Id,
        personnel_id: bobId,
        travel_type: "other",
        direction: "outbound",
        departure_location: "Hotel",
        arrival_location: "Hotel",
        departure_datetime: "2028-03-19T15:00:00Z",
        arrival_datetime: "2028-03-22T11:00:00Z",
        cost: 0,
        currency: "USD",
        status: "booked",
        accommodation: {
          hotel_name: "Shared",
          check_in_date: "2028-03-19",
          check_out_date: "2028-03-22",
          nightly_rate: 180,
          total_cost: 540,
        },
      });
    expect(hotelBob.status).toBe(201);

    const hotelCh = await request(app)
      .post("/api/v1/travel")
      .set(a)
      .send({
        event_id: event1Id,
        personnel_id: charlieId,
        travel_type: "other",
        direction: "outbound",
        departure_location: "Hotel",
        arrival_location: "Hotel",
        departure_datetime: "2028-03-19T15:00:00Z",
        arrival_datetime: "2028-03-22T11:00:00Z",
        cost: 0,
        currency: "USD",
        status: "booked",
        accommodation: {
          hotel_name: "Shared",
          check_in_date: "2028-03-19",
          check_out_date: "2028-03-22",
          nightly_rate: 180,
          total_cost: 540,
        },
      });
    expect(hotelCh.status).toBe(201);

    // Step 16 — travel.created bus (WAIVE / covered in supplement)

    await recalculateEventCostsInternal(tenantId, event1Id, { triggered_by: "cp2.workflow.test" });

    // Steps 17–20 — financial aggregates (labor 4650 + per diem 675 + travel + truck)
    const finList = await request(app)
      .get(`/api/v1/events/${event1Id}/financials`)
      .query({ limit: 100, source: "calculated" })
      .set(a);
    expect(finList.status).toBe(200);
    const recs = finList.body.data as { category?: string; amount?: string; description?: string }[];
    const labor = recs.filter((r) => r.category === "labor").reduce((s, r) => s + Number(r.amount), 0);
    const miscPerDiem = recs
      .filter((r) => r.description?.includes("Per diem"))
      .reduce((s, r) => s + Number(r.amount), 0);
    expect(labor).toBe(4650);
    expect(miscPerDiem).toBe(675);

    const travelSum = recs
      .filter((r) => r.category === "travel")
      .reduce((s, r) => s + Number(r.amount), 0);
    expect(travelSum).toBeGreaterThanOrEqual(420 + 600 + 540 + 540);

    const bud = await request(app).get(`/api/v1/events/${event1Id}/budget`).set(a);
    expect(bud.status).toBe(200);
    expect(Number(bud.body.data.total_costs)).toBeGreaterThan(6000);

    // Steps 21–22 — rider PDF / items: WAIVE (multipart + rider pipeline)

    // Steps 23–24 — generate documents
    const tplDay = await request(app)
      .post("/api/v1/templates")
      .set(a)
      .send({
        name: `Day sheet ${uuidv7().slice(0, 6)}`,
        category: "day_sheet",
        content: "<h1>{{event_name}}</h1><p>{{event_start_date}}</p>{{personnel_table}}",
        format: "html",
        default_output_format: "html",
      });
    expect(tplDay.status).toBe(201);

    const gen1 = await request(app)
      .post("/api/v1/documents/generate")
      .set(a)
      .send({
        template_id: tplDay.body.data.id,
        event_id: event1Id,
        output_format: "html",
        name: "Day sheet Mar 20",
      });
    expect(gen1.status).toBe(201);
    const gen1DocId = gen1.body.data.id as string;
    const gen1Dl = await request(app).get(`/api/v1/documents/${gen1DocId}`).set(a);
    expect(gen1Dl.status).toBe(200);
    expect(String(gen1Dl.body.meta?.download_url ?? "")).toContain("/documents/");

    const tplPack = await request(app)
      .post("/api/v1/templates")
      .set(a)
      .send({
        name: `Crew pack ${uuidv7().slice(0, 6)}`,
        category: "crew_pack",
        content: "<p>{{event_name}} — {{event_phase}}</p>{{custom_fields_list}}",
        format: "html",
        default_output_format: "html",
      });
    expect(tplPack.status).toBe(201);

    const gen2 = await request(app)
      .post("/api/v1/documents/generate")
      .set(a)
      .send({
        template_id: tplPack.body.data.id,
        event_id: event1Id,
        output_format: "html",
        name: "Crew pack",
      });
    expect(gen2.status).toBe(201);
    const docPackId = gen2.body.data.id as string;

    // Step 25 — list documents for event
    const docs = await request(app)
      .get("/api/v1/documents")
      .query({ event_id: event1Id, limit: 50 })
      .set(a);
    expect(docs.status).toBe(200);
    expect((docs.body.data as unknown[]).length).toBeGreaterThanOrEqual(2);

    // Step 26 — pre_production → production (still have Alice conflict)
    const ph2 = await request(app)
      .put(`/api/v1/events/${event1Id}/phase`)
      .set(h)
      .send({ phase: "production" });
    expect(ph2.status).toBe(200);

    // Step 27 — unresolved conflict still present (product flag WAIVE; assert data still shows conflict)
    conf = await request(app).get("/api/v1/conflicts").query({ limit: 50 }).set(a);
    const still = (conf.body.data as { status?: string }[]).filter((x) => x.status === "active");
    expect(still.length).toBeGreaterThanOrEqual(1);

    const docGet = await request(app).get(`/api/v1/documents/${docPackId}`).set(a);
    expect(docGet.status).toBe(200);
    expect(docGet.body.data.stale).toBe(true);
  });
});
