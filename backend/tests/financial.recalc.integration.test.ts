import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import * as clientsRepo from "../src/modules/clients/repository.js";
import * as evRepo from "../src/modules/events/repository.js";
import * as pRepo from "../src/modules/personnel/personnel.repository.js";
import { createCrewAssignmentApi } from "../src/modules/scheduling/crew-assignments.service.js";
import { createTravelRecordApi } from "../src/modules/travel/service.js";
import { recalculateEventCostsApi } from "../src/modules/financial/financial.service.js";
import * as finRepo from "../src/modules/financial/financial.repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

async function applyMigrations(pool: pg.Pool) {
  const files = [
    "001_init_events_clients_venues.sql",
    "002_custom_fields.sql",
    "002_personnel_departments_invitations.sql",
    "002_trucks_routes_truck_assignments.sql",
    "003_crew_assignments_scheduling_conflicts.sql",
    "003_travel_records.sql",
    "003_financial_invoices.sql",
  ];
  for (const f of files) {
    const sql = readFileSync(path.join(migrationsDir, f), "utf8");
    await pool.query(sql);
  }
}

describe("financial recalculate (Postgres)", () => {
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      const hasFr = await pool.query(`SELECT to_regclass('public.financial_records') AS t`);
      if (!hasFr.rows[0]?.t) {
        await applyMigrations(pool);
      } else {
        const hasTravel = await pool.query(`SELECT to_regclass('public.travel_records') AS t`);
        if (!hasTravel.rows[0]?.t) {
          const sql = readFileSync(
            path.join(migrationsDir, "003_travel_records.sql"),
            "utf8",
          );
          await pool.query(sql);
        }
      }
    } catch (e) {
      console.warn("Skipping financial recalc integration tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("recalculate inserts calculated labor, per diem, and travel from peer facades", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "Fin Client",
      contactName: null,
      contactEmail: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const eventId = uuidv7();
    await evRepo.insertEvent(pool, {
      id: eventId,
      tenantId,
      name: "Fin Event",
      clientId,
      venueId: null,
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      loadIn: null,
      loadOut: null,
      status: "draft",
      phase: "planning",
      description: null,
      tags: [],
      metadata: {},
      customFields: {},
      createdBy: null,
    });
    const personnelId = uuidv7();
    await pRepo.insertPersonnel(pool, {
      id: personnelId,
      tenant_id: tenantId,
      user_id: null,
      first_name: "Pat",
      last_name: "Crew",
      email: `pat-${personnelId.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "audio",
      employment_type: "freelance",
      skills: [],
      day_rate_amount: 100,
      day_rate_currency: "USD",
      per_diem_amount: 50,
      per_diem_currency: "USD",
      status: "active",
      emergency_contact: null,
      metadata: {},
    });

    const userId = uuidv7();
    const a1 = await createCrewAssignmentApi({
      tenantId,
      userId,
      eventId,
      personnelId,
      role: "A1",
      departmentId: null,
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      startTime: null,
      endTime: null,
      dayRateOverride: null,
      perDiemOverride: null,
      notes: null,
      status: "confirmed",
    });
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;

    const tr = await createTravelRecordApi({
      tenantId,
      userId,
      body: {
        event_id: eventId,
        personnel_id: personnelId,
        travel_type: "flight",
        direction: "outbound",
        departure_location: "LAX",
        arrival_location: "ORD",
        departure_datetime: "2026-07-31T14:00:00.000Z",
        arrival_datetime: "2026-07-31T20:00:00.000Z",
        carrier: "Test Air",
        booking_reference: null,
        seat_preference: null,
        cost: 250,
        currency: "USD",
        status: "confirmed",
        notes: null,
        accommodation: null,
        metadata: {},
      },
    });
    expect(tr.ok).toBe(true);
    if (!tr.ok) return;

    const out = await recalculateEventCostsApi(tenantId, eventId, {
      triggered_by: "test",
    });
    expect(out.records_created).toBeGreaterThanOrEqual(1);
    expect(out.records_deleted).toBeGreaterThanOrEqual(0);

    const { rows } = await finRepo.listFinancialRecords(pool, {
      tenantId,
      eventId,
      type: "cost",
      sources: ["calculated"],
      sortBy: "created_at",
      sortOrder: "desc",
      limit: 50,
      offset: 0,
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const cats = new Set(rows.map((r) => r.category));
    expect(cats.has("labor")).toBe(true);
    expect(cats.has("miscellaneous")).toBe(true);
    expect(cats.has("travel")).toBe(true);
  });
});
