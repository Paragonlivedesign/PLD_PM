import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import * as pRepo from "../src/modules/personnel/personnel.repository.js";
import { getAssignmentsForPersonnelDateRange } from "../src/modules/scheduling/personnel-bridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

describe("personnel (Postgres)", () => {
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      const check = await pool.query(`SELECT to_regclass('public.personnel') AS t`);
      if (!check.rows[0]?.t) {
        await pool.query(readMigration("001_init_events_clients_venues.sql"));
        await pool.query(readMigration("002_personnel_departments_invitations.sql"));
      }
    } catch (e) {
      console.warn("Skipping personnel integration tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("tenant isolation for personnel", async () => {
    if (skip) return;
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const pid = uuidv7();
    await pRepo.insertPersonnel(pool, {
      id: pid,
      tenant_id: tenantA,
      user_id: null,
      first_name: "Test",
      last_name: "User",
      email: `iso-${pid.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "Engineer",
      employment_type: "full_time",
      skills: [],
      day_rate_amount: 100,
      day_rate_currency: "USD",
      per_diem_amount: null,
      per_diem_currency: "USD",
      status: "active",
      emergency_contact: null,
      metadata: {},
    });
    const fromB = await pRepo.findPersonnelById(pool, tenantB, pid, true);
    expect(fromB).toBeNull();
    const fromA = await pRepo.findPersonnelById(pool, tenantA, pid, true);
    expect(fromA?.id).toBe(pid);
  });

  it("scheduling personnel-bridge returns an array for a known person (assignment integration optional)", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const pid = uuidv7();
    await pRepo.insertPersonnel(pool, {
      id: pid,
      tenant_id: tenantId,
      user_id: null,
      first_name: "Avail",
      last_name: "Test",
      email: `avail-${pid.slice(0, 8)}@example.com`,
      phone: null,
      department_id: null,
      role: "Rigger",
      employment_type: "contractor",
      skills: [],
      day_rate_amount: null,
      day_rate_currency: "USD",
      per_diem_amount: null,
      per_diem_currency: "USD",
      status: "active",
      emergency_contact: null,
      metadata: {},
    });
    const days = await getAssignmentsForPersonnelDateRange(
      tenantId,
      pid,
      "2026-06-01",
      "2026-06-05",
    );
    expect(Array.isArray(days)).toBe(true);
  });
});
