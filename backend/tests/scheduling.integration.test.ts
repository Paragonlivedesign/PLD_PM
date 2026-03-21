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
import { listConflictsApi } from "../src/modules/scheduling/conflicts-list.service.js";
import { getScheduleViewApi } from "../src/modules/scheduling/schedule.service.js";
import { bulkCreateAssignmentsApi } from "../src/modules/scheduling/bulk-assignments.service.js";
import { getCrewAssignment } from "../src/modules/scheduling/crew-assignments.service.js";
import { domainBus } from "../src/domain/bus.js";

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
  ];
  for (const f of files) {
    const sql = readFileSync(path.join(migrationsDir, f), "utf8");
    await pool.query(sql);
  }
}

describe("scheduling (Postgres)", () => {
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      const hasEvents = await pool.query(`SELECT to_regclass('public.events') AS t`);
      if (!hasEvents.rows[0]?.t) {
        await applyMigrations(pool);
      } else {
        const hasCrew = await pool.query(
          `SELECT to_regclass('public.crew_assignments') AS t`,
        );
        if (!hasCrew.rows[0]?.t) {
          const sql = readFileSync(
            path.join(migrationsDir, "003_crew_assignments_scheduling_conflicts.sql"),
            "utf8",
          );
          await pool.query(sql);
        }
      }
    } catch (e) {
      console.warn("Skipping scheduling integration tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("crew tentative overlap creates soft conflict and schedule view", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "Sched Client",
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
      name: "Sched Event",
      clientId,
      venueId: null,
      startDate: "2026-06-01",
      endDate: "2026-06-10",
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
      first_name: "Sam",
      last_name: "Tech",
      email: `sam-${personnelId.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "tech",
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
      role: "FOH",
      departmentId: null,
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      startTime: null,
      endTime: null,
      dayRateOverride: null,
      perDiemOverride: null,
      notes: null,
      status: "tentative",
    });
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    expect(a1.conflicts.length).toBe(0);

    const a2 = await createCrewAssignmentApi({
      tenantId,
      userId,
      eventId,
      personnelId,
      role: "MON",
      departmentId: null,
      startDate: "2026-06-03",
      endDate: "2026-06-08",
      startTime: null,
      endTime: null,
      dayRateOverride: null,
      perDiemOverride: null,
      notes: null,
      status: "tentative",
    });
    expect(a2.ok).toBe(true);
    if (!a2.ok) return;
    expect(a2.conflicts.length).toBeGreaterThan(0);

    const cf = await listConflictsApi({
      tenantId,
      limit: 25,
      cursorId: null,
    });
    expect(cf.rows.length).toBeGreaterThan(0);
    expect(cf.rows[0]!.severity).toBe("soft");

    const sched = await getScheduleViewApi({
      tenantId,
      view: "month",
      date: "2026-06-15",
      resourceType: "event",
      eventId,
    });
    expect(sched.data.resources.length).toBeGreaterThan(0);
    expect(sched.meta.total_assignments).toBeGreaterThanOrEqual(2);
  });

  it("tenant isolation on crew assignment read", async () => {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId: tenantA,
      name: "Iso2",
      contactName: null,
      contactEmail: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const eventId = uuidv7();
    await evRepo.insertEvent(pool, {
      id: eventId,
      tenantId: tenantA,
      name: "E2",
      clientId,
      venueId: null,
      startDate: "2026-07-01",
      endDate: "2026-07-02",
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
      tenant_id: tenantA,
      user_id: null,
      first_name: "A",
      last_name: "B",
      email: `ab-${personnelId.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "x",
      employment_type: "freelance",
      skills: [],
      day_rate_amount: 1,
      day_rate_currency: "USD",
      per_diem_amount: 1,
      per_diem_currency: "USD",
      status: "active",
      emergency_contact: null,
      metadata: {},
    });
    const r = await createCrewAssignmentApi({
      tenantId: tenantA,
      userId: uuidv7(),
      eventId,
      personnelId,
      role: "R",
      departmentId: null,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      startTime: null,
      endTime: null,
      dayRateOverride: null,
      perDiemOverride: null,
      notes: null,
      status: "tentative",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const fromB = await getCrewAssignment(tenantB, r.data.id);
    expect(fromB).toBeNull();
  });

  it("bulk fail rolls back on truck overlap", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "Bulk C",
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
      name: "Bulk E",
      clientId,
      venueId: null,
      startDate: "2026-08-01",
      endDate: "2026-08-10",
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
    const truckId = uuidv7();
    await pool.query(
      `INSERT INTO trucks (id, tenant_id, name, type, status, metadata)
       VALUES ($1, $2, 'T1', 'box_truck', 'available', '{}')`,
      [truckId, tenantId],
    );

    const r = await bulkCreateAssignmentsApi({
      tenantId,
      userId: uuidv7(),
      conflictStrategy: "fail",
      assignments: [
        {
          type: "truck",
          event_id: eventId,
          resource_id: truckId,
          start_date: "2026-08-01",
          end_date: "2026-08-05",
        },
        {
          type: "truck",
          event_id: eventId,
          resource_id: truckId,
          start_date: "2026-08-04",
          end_date: "2026-08-06",
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(409);

    const cnt = await pool.query(
      `SELECT count(*)::int AS c FROM truck_assignments WHERE tenant_id = $1 AND truck_id = $2 AND deleted_at IS NULL`,
      [tenantId, truckId],
    );
    expect(cnt.rows[0]?.c).toBe(0);
  });

  it("bulk success emits bulk_operation.completed and returns operation_id in meta", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "BulkEvt Client",
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
      name: "BulkEvt",
      clientId,
      venueId: null,
      startDate: "2026-10-01",
      endDate: "2026-10-10",
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
      first_name: "Bulk",
      last_name: "Op",
      email: `bulk-${personnelId.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "tech",
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

    let busPayload: Record<string, unknown> | null = null;
    const onBulk = (p: unknown) => {
      busPayload = p as Record<string, unknown>;
    };
    domainBus.once("bulk_operation.completed", onBulk);

    const r = await bulkCreateAssignmentsApi({
      tenantId,
      userId,
      conflictStrategy: "warn",
      assignments: [
        {
          type: "crew",
          event_id: eventId,
          resource_id: personnelId,
          start_date: "2026-10-02",
          end_date: "2026-10-03",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta.operation_id).toBeTruthy();
    expect(busPayload).not.toBeNull();
    expect(busPayload?.tenant_id).toBe(tenantId);
    expect(busPayload?.initiated_by).toBe(userId);
    expect(busPayload?.operation_id).toBe(r.meta.operation_id);
    expect(busPayload?.total_created).toBe(1);
    expect(busPayload?.conflict_strategy).toBe("warn");
  });
});
