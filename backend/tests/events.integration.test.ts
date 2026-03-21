import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import * as evRepo from "../src/modules/events/repository.js";
import * as clientsRepo from "../src/modules/clients/repository.js";
import * as evSvc from "../src/modules/events/service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

async function ensureMigrations(pool: pg.Pool) {
  const check = await pool.query(`SELECT to_regclass('public.events') AS t`);
  if (!check.rows[0]?.t) {
    await pool.query(readMigration("001_init_events_clients_venues.sql"));
  }
  const cf = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'custom_fields'
  `);
  if (!cf.rows.length) {
    await pool.query(readMigration("002_custom_fields.sql"));
  }
}

describe("events + clients (Postgres)", () => {
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      await ensureMigrations(pool);
    } catch (e) {
      console.warn("Skipping integration tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("tenant isolation for events", async function () {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId: tenantA,
      name: "Iso Client",
      contactName: null,
      contactEmail: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const evId = uuidv7();
    await evRepo.insertEvent(pool, {
      id: evId,
      tenantId: tenantA,
      name: "Iso Event",
      clientId,
      venueId: null,
      startDate: "2026-06-01",
      endDate: "2026-06-02",
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
    const fromB = await evRepo.getEventById(pool, tenantB, evId);
    expect(fromB).toBeNull();
    const fromA = await evRepo.getEventById(pool, tenantA, evId);
    expect(fromA?.id).toBe(evId);
  });

  it("listEventsQuery returns rows and total_count alignment", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "List Client",
      contactName: null,
      contactEmail: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const name = `List Test ${uuidv7().slice(0, 8)}`;
    const r = await evSvc.createEvent(tenantId, uuidv7(), {
      name,
      client_id: clientId,
      venue_id: null,
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const list = await evSvc.listEventsQuery(tenantId, {
      search: name,
      limit: 10,
      sort_by: "start_date",
      sort_order: "asc",
    });
    expect(list.rows.some((row) => row.id === r.event.id)).toBe(true);
    expect(list.total >= 1).toBe(true);
  });

  it("updateEvent returns conflict when updated_at is stale", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const clientId = uuidv7();
    await clientsRepo.insertClient(pool, {
      id: clientId,
      tenantId,
      name: "Conflict Client",
      contactName: null,
      contactEmail: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const created = await evSvc.createEvent(tenantId, userId, {
      name: `Conflict ${uuidv7().slice(0, 8)}`,
      client_id: clientId,
      venue_id: null,
      start_date: "2026-08-01",
      end_date: "2026-08-02",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const stale = new Date(Date.parse(created.event.updated_at) - 60_000).toISOString();
    const up = await evSvc.updateEvent(tenantId, userId, created.event.id, {
      name: "Renamed",
      updated_at: stale,
    });
    expect(up.ok).toBe(false);
    if (up.ok) return;
    expect(up.status).toBe(409);
    expect(up.code).toBe("conflict");
  });
});
