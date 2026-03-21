/**
 * CRM + workforce routes: nested contacts, event primary_contact_id, /me/crew-assignments,
 * time clock/list, pay periods, payroll export, vendor linked_client_id.
 *
 * Requires Postgres with migration 012+ (contacts, vendors FK). Set PLD_SKIP_TENANT_RESOLUTION=1.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

describe("CRM + workforce API (HTTP)", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    process.env.PLD_SKIP_TENANT_RESOLUTION = "1";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const t = await pool.query(`SELECT to_regclass('public.contacts') AS c`);
      if (!t.rows[0]?.c) skip = true;
      if (!skip) {
        const v = await pool.query(`SELECT to_regclass('public.vendors') AS x`);
        if (!v.rows[0]?.x) {
          const sql = readFileSync(path.join(migrationsDir, "007_vendors.sql"), "utf8");
          await pool.query(sql);
        }
        await pool.query(`
DO $pld_vendor_link$
BEGIN
  IF to_regclass('public.vendors') IS NOT NULL THEN
    ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS linked_client_id UUID REFERENCES clients (id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_vendors_linked_client
      ON vendors (tenant_id, linked_client_id)
      WHERE deleted_at IS NULL AND linked_client_id IS NOT NULL;
  END IF;
END
$pld_vendor_link$;
`);
      }
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("nested contacts, primary_contact_id validation, me, time, pay, vendor link", async () => {
    if (skip) return;
    const tenantId = uuidv7();
    const userId = uuidv7();

    await pool.query(
      `INSERT INTO tenants (id, name, slug, status, settings)
       VALUES ($1, 'CRM integration tenant', $2, 'active', '{}')
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, "crm-" + tenantId.replace(/-/g, "").slice(0, 20)],
    );

    const c = await request(app)
      .post("/api/v1/clients")
      .set(apiHeaders(tenantId, userId))
      .send({ name: `CRM Client ${uuidv7().slice(0, 8)}` });
    expect(c.status).toBe(201);
    const clientId = c.body.data.id as string;

    const cc = await request(app)
      .post(`/api/v1/clients/${clientId}/contacts`)
      .set(apiHeaders(tenantId, userId))
      .send({ name: "Alice", email: "alice@example.com" });
    expect(cc.status).toBe(201);
    const contactId = cc.body.data.id as string;

    const venue = await request(app)
      .post("/api/v1/venues")
      .set(apiHeaders(tenantId, userId))
      .send({ name: `CRM Venue ${uuidv7().slice(0, 6)}`, city: "NYC" });
    expect(venue.status).toBe(201);
    const venueId = venue.body.data.id as string;

    const vc = await request(app)
      .post(`/api/v1/venues/${venueId}/contacts`)
      .set(apiHeaders(tenantId, userId))
      .send({ name: "Bob" });
    expect(vc.status).toBe(201);
    const venueContactId = vc.body.data.id as string;

    const vendorId = uuidv7();
    await pool.query(
      `INSERT INTO vendors (id, tenant_id, name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`,
      [vendorId, tenantId, `Vendor ${vendorId.slice(0, 8)}`],
    );

    const vco = await request(app)
      .post(`/api/v1/vendors/${vendorId}/contacts`)
      .set(apiHeaders(tenantId, userId))
      .send({ name: "Carol" });
    expect(vco.status).toBe(201);
    const vendorContactId = vco.body.data.id as string;

    const ev = await request(app)
      .post("/api/v1/events")
      .set(apiHeaders(tenantId, userId))
      .send({
        name: `CRM Event ${uuidv7().slice(0, 8)}`,
        client_id: clientId,
        venue_id: venueId,
        start_date: "2026-08-01",
        end_date: "2026-08-03",
        primary_contact_id: contactId,
      });
    expect(ev.status).toBe(201);
    const eventId = ev.body.data.id as string;
    expect(ev.body.data.primary_contact_id).toBe(contactId);

    const badPut = await request(app)
      .put(`/api/v1/events/${eventId}`)
      .set(apiHeaders(tenantId, userId))
      .send({
        updated_at: ev.body.data.updated_at,
        primary_contact_id: vendorContactId,
      });
    expect(badPut.status).toBe(400);

    const goodVenueContact = await request(app)
      .put(`/api/v1/events/${eventId}`)
      .set(apiHeaders(tenantId, userId))
      .send({
        updated_at: ev.body.data.updated_at,
        primary_contact_id: venueContactId,
      });
    expect(goodVenueContact.status).toBe(200);
    expect(goodVenueContact.body.data.primary_contact_id).toBe(venueContactId);

    const me = await request(app)
      .get("/api/v1/me/crew-assignments")
      .set(apiHeaders(tenantId, userId));
    expect(me.status).toBe(200);

    const clockIn = await request(app)
      .post("/api/v1/time/clock-in")
      .set(apiHeaders(tenantId, userId))
      .send({});
    expect(clockIn.status).toBe(400);

    const entries = await request(app)
      .get("/api/v1/time/entries")
      .set(apiHeaders(tenantId, userId));
    expect(entries.status).toBe(200);

    const periods = await request(app)
      .get("/api/v1/pay-periods")
      .set(apiHeaders(tenantId, userId));
    expect(periods.status).toBe(200);

    const pp = await request(app)
      .post("/api/v1/pay-periods")
      .set(apiHeaders(tenantId, userId))
      .send({
        period_start: "2026-01-01",
        period_end: "2026-01-14",
        pay_date: "2026-01-15",
      });
    expect(pp.status).toBe(201);

    const exp = await request(app)
      .get("/api/v1/payroll/export")
      .set(apiHeaders(tenantId, userId));
    expect(exp.status).toBe(200);

    const venPut = await request(app)
      .put(`/api/v1/vendors/${vendorId}`)
      .set(apiHeaders(tenantId, userId))
      .send({ linked_client_id: clientId });
    expect(venPut.status).toBe(200);
    expect(venPut.body.data.linked_client_id).toBe(clientId);

    const venCreate = await request(app)
      .post("/api/v1/vendors")
      .set(apiHeaders(tenantId, userId))
      .send({ name: `Vendor CRUD ${Date.now()}` });
    expect(venCreate.status).toBe(201);
    const newVendorId = venCreate.body.data.id as string;

    const venPatch = await request(app)
      .put(`/api/v1/vendors/${newVendorId}`)
      .set(apiHeaders(tenantId, userId))
      .send({ name: "Vendor CRUD renamed", phone: "555-0100" });
    expect(venPatch.status).toBe(200);
    expect(venPatch.body.data.name).toBe("Vendor CRUD renamed");

    const venDel = await request(app)
      .delete(`/api/v1/vendors/${newVendorId}`)
      .set(apiHeaders(tenantId, userId));
    expect(venDel.status).toBe(200);
  });
});
