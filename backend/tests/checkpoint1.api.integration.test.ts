/**
 * Checkpoint 1 (integration-checkpoints.md) — HTTP-level coverage for Wave 1 modules.
 * Categories: A (contract CRUD slice), B (tenant isolation), C (custom fields on event),
 * D (domain events), E (events phase + clone slice).
 *
 * Requires Postgres. If `events` is missing, applies all SQL files in database/migrations (sorted).
 * Run: `npm run db:migrate` from repo root, then `npm test -w backend`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { v7 as uuidv7 } from "uuid";
import { domainBus } from "../src/domain/bus.js";
import { onEvent } from "../src/core/events.js";
import { pool } from "../src/db/pool.js";
import { buildApp } from "../src/app-factory.js";
import {
  FIELD_DEFINITION_CREATED,
} from "../src/modules/custom-fields/events.js";

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
    console.warn("checkpoint1.api: DB unavailable or migration failed:", e);
    return false;
  }
}

/** Routes under middleware/context (capital X headers). */
function ctxHeaders(tenantId: string, userId: string) {
  return {
    "X-Tenant-Id": tenantId,
    "X-User-Id": userId,
  };
}

/** Routes under requestContextMiddleware (lowercase x headers + permissions). */
function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

describe("Checkpoint 1 — API (PLD_PM)", () => {
  let okDb = false;
  const app = buildApp();

  beforeAll(async () => {
    okDb = await ensureSchema();
    if (process.env.CI === "true" && !okDb) {
      throw new Error(
        "Checkpoint 1 API tests require Postgres in CI (see .github/workflows/ci.yml test-backend job).",
      );
    }
    if (okDb) {
      process.env.PLD_SKIP_TENANT_RESOLUTION = "1";
    }
  });

  afterAll(async () => {
    // pool is process-wide; do not end() here — other tests may share it
  });

  describe("Category B — tenant isolation", () => {
    it("1.B.1–1.B.2 events: cross-tenant list empty and GET by id 404", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const userA = uuidv7();
      const userB = uuidv7();

      const c = await request(app)
        .post("/api/v1/clients")
        .set(ctxHeaders(tenantA, userA))
        .send({ name: `CP1 Client ${tenantA.slice(0, 8)}` });
      expect(c.status).toBe(201);
      const clientId = c.body.data.id as string;

      const ev = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantA, userA))
        .send({
          name: `CP1 Iso Event ${uuidv7().slice(0, 8)}`,
          client_id: clientId,
          start_date: "2026-09-01",
          end_date: "2026-09-03",
        });
      expect(ev.status).toBe(201);
      const eventId = ev.body.data.id as string;

      const listB = await request(app).get("/api/v1/events").set(ctxHeaders(tenantB, userB));
      expect(listB.status).toBe(200);
      const rows = listB.body.data as unknown[];
      expect(rows.every((r: { id?: string }) => r.id !== eventId)).toBe(true);

      const getB = await request(app)
        .get(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantB, userB));
      expect(getB.status).toBe(404);
    });

    it("1.B.3–1.B.4 events: other tenant cannot PUT or DELETE", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const userA = uuidv7();
      const userB = uuidv7();

      const c = await request(app)
        .post("/api/v1/clients")
        .set(ctxHeaders(tenantA, userA))
        .send({ name: `CP1 Mut Client ${uuidv7().slice(0, 8)}` });
      expect(c.status).toBe(201);

      const ev = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantA, userA))
        .send({
          name: `CP1 Mut Event ${uuidv7().slice(0, 8)}`,
          client_id: c.body.data.id,
          start_date: "2026-09-10",
          end_date: "2026-09-12",
        });
      expect(ev.status).toBe(201);
      const eventId = ev.body.data.id as string;
      const updatedAt = ev.body.data.updated_at as string;

      const putB = await request(app)
        .put(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantB, userB))
        .send({ name: "cross-tenant-hijack", updated_at: updatedAt });
      expect(putB.status).toBe(404);

      const delB = await request(app)
        .delete(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantB, userB));
      expect(delB.status).toBe(404);

      const getA = await request(app)
        .get(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantA, userA));
      expect(getA.status).toBe(200);
    });

    it("1.B.5 personnel: other tenant cannot GET personnel by id", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const user = uuidv7();
      const email = `cp1-p-${uuidv7().slice(0, 8)}@example.com`;

      const post = await request(app)
        .post("/api/v1/personnel")
        .set(apiHeaders(tenantA, user))
        .send({
          first_name: "CP1",
          last_name: "Iso",
          email,
          role: "Tech",
          employment_type: "full_time",
        });
      expect(post.status).toBe(201);
      const pid = post.body.data.id as string;

      const getB = await request(app)
        .get(`/api/v1/personnel/${pid}`)
        .set(apiHeaders(tenantB, user));
      expect(getB.status).toBe(404);
    });

    it("1.B.3–1.B.4 personnel: other tenant cannot PUT", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const user = uuidv7();
      const email = `cp1-pmut-${uuidv7().slice(0, 8)}@example.com`;

      const post = await request(app)
        .post("/api/v1/personnel")
        .set(apiHeaders(tenantA, user))
        .send({
          first_name: "CP1",
          last_name: "PutIso",
          email,
          role: "Tech",
          employment_type: "full_time",
        });
      expect(post.status).toBe(201);
      const pid = post.body.data.id as string;
      const ver = post.body.data.version as number;

      const putB = await request(app)
        .put(`/api/v1/personnel/${pid}`)
        .set(apiHeaders(tenantB, user))
        .send({ first_name: "Hijack", version: ver });
      expect(putB.status).toBe(404);
    });

    it("1.B.5 trucks: other tenant cannot GET truck by id", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const user = uuidv7();

      const post = await request(app)
        .post("/api/v1/trucks")
        .set(apiHeaders(tenantA, user))
        .send({
          name: `CP1 Truck ${uuidv7().slice(0, 8)}`,
          type: "box_truck",
          status: "available",
        });
      expect(post.status).toBe(201);
      const tid = post.body.data.id as string;

      const getB = await request(app)
        .get(`/api/v1/trucks/${tid}`)
        .set(apiHeaders(tenantB, user));
      expect(getB.status).toBe(404);
    });

    it("1.B.3–1.B.4 trucks: other tenant cannot PUT or DELETE", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const user = uuidv7();
      const name = `CP1 Truck Mut ${uuidv7().slice(0, 8)}`;

      const post = await request(app)
        .post("/api/v1/trucks")
        .set(apiHeaders(tenantA, user))
        .send({
          name,
          type: "box_truck",
          status: "available",
        });
      expect(post.status).toBe(201);
      const tid = post.body.data.id as string;
      const updatedAt = post.body.data.updated_at as string;

      const putB = await request(app)
        .put(`/api/v1/trucks/${tid}`)
        .set(apiHeaders(tenantB, user))
        .send({ name: "stolen", updated_at: updatedAt });
      expect(putB.status).toBe(404);

      const delB = await request(app)
        .delete(`/api/v1/trucks/${tid}`)
        .set(apiHeaders(tenantB, user));
      expect(delB.status).toBe(404);

      const getA = await request(app)
        .get(`/api/v1/trucks/${tid}`)
        .set(apiHeaders(tenantA, user));
      expect(getA.status).toBe(200);
    });

    it("1.C.10 custom field definitions not visible to other tenant", async () => {
      if (!okDb) return;
      const tenantA = uuidv7();
      const tenantB = uuidv7();
      const user = uuidv7();
      const key = `cp1_cf_${uuidv7().slice(0, 8)}`;

      const def = await request(app)
        .post("/api/v1/custom-fields")
        .set(apiHeaders(tenantA, user))
        .send({
          entity_type: "event",
          field_key: key,
          label: "CP1 Field",
          field_type: "text",
          is_required: false,
        });
      expect(def.status).toBe(201);

      const listB = await request(app)
        .get("/api/v1/custom-fields")
        .query({ entity_type: "event" })
        .set(apiHeaders(tenantB, user));
      expect(listB.status).toBe(200);
      const data = listB.body.data as { field_key: string }[];
      expect(data.some((d) => d.field_key === key)).toBe(false);
    });
  });

  describe("Category A — contract slice (HTTP)", () => {
    it("events: CRUD + list limit + validation", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();

      const c = await request(app)
        .post("/api/v1/clients")
        .set(ctxHeaders(tenantId, userId))
        .send({ name: `CP1 CRUD Client ${uuidv7().slice(0, 8)}` });
      expect(c.status).toBe(201);
      const clientId = c.body.data.id as string;

      const bad = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantId, userId))
        .send({ name: "", client_id: clientId, start_date: "2026-10-01", end_date: "2026-10-02" });
      expect(bad.status).toBe(400);

      const create = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantId, userId))
        .send({
          name: `CP1 CRUD ${uuidv7().slice(0, 8)}`,
          client_id: clientId,
          start_date: "2026-10-01",
          end_date: "2026-10-05",
        });
      expect(create.status).toBe(201);
      const id = create.body.data.id as string;
      expect(create.body.data.name).toBeTruthy();

      const getOne = await request(app)
        .get(`/api/v1/events/${id}`)
        .set(ctxHeaders(tenantId, userId));
      expect(getOne.status).toBe(200);
      expect(getOne.body.data.id).toBe(id);

      const put = await request(app)
        .put(`/api/v1/events/${id}`)
        .set(ctxHeaders(tenantId, userId))
        .send({
          name: "CP1 renamed",
          updated_at: getOne.body.data.updated_at,
        });
      expect(put.status).toBe(200);
      expect(put.body.data.name).toBe("CP1 renamed");

      const list = await request(app)
        .get("/api/v1/events")
        .query({ limit: 2, search: "CP1 renamed" })
        .set(ctxHeaders(tenantId, userId));
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data)).toBe(true);
      expect(list.body.data.length).toBeLessThanOrEqual(2);
      expect(list.body.meta).toBeDefined();

      const del = await request(app)
        .delete(`/api/v1/events/${id}`)
        .set(ctxHeaders(tenantId, userId));
      expect(del.status).toBe(200);

      const gone = await request(app)
        .get(`/api/v1/events/${id}`)
        .set(ctxHeaders(tenantId, userId));
      expect(gone.status).toBe(404);
    });

    it("personnel: create, get, update", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();
      const email = `cp1-per-${uuidv7().slice(0, 8)}@example.com`;

      const post = await request(app)
        .post("/api/v1/personnel")
        .set(apiHeaders(tenantId, userId))
        .send({
          first_name: "Ada",
          last_name: "Lovelace",
          email,
          role: "Engineer",
          employment_type: "full_time",
        });
      expect(post.status).toBe(201);
      const id = post.body.data.id as string;

      const get = await request(app)
        .get(`/api/v1/personnel/${id}`)
        .set(apiHeaders(tenantId, userId));
      expect(get.status).toBe(200);

      const put = await request(app)
        .put(`/api/v1/personnel/${id}`)
        .set(apiHeaders(tenantId, userId))
        .send({
          first_name: "Augusta",
          version: get.body.data.version,
        });
      expect(put.status).toBe(200);
      expect(put.body.data.first_name).toBe("Augusta");
    });

    it("trucks: create, get, list", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();
      const name = `CP1 Truck List ${uuidv7().slice(0, 8)}`;

      const post = await request(app)
        .post("/api/v1/trucks")
        .set(apiHeaders(tenantId, userId))
        .send({
          name,
          type: "box_truck",
          status: "available",
        });
      expect(post.status).toBe(201);
      const id = post.body.data.id as string;

      const get = await request(app)
        .get(`/api/v1/trucks/${id}`)
        .set(apiHeaders(tenantId, userId));
      expect(get.status).toBe(200);

      const list = await request(app)
        .get("/api/v1/trucks")
        .query({ search: name, limit: 5 })
        .set(apiHeaders(tenantId, userId));
      expect(list.status).toBe(200);
      expect((list.body.data as unknown[]).some((t: { id?: string }) => t.id === id)).toBe(true);
    });
  });

  describe("Category C — custom fields on event", () => {
    it("1.C.1–1.C.4 define field, create event with value, read, update", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();
      const fieldKey = `region_${uuidv7().slice(0, 8)}`;

      const c = await request(app)
        .post("/api/v1/clients")
        .set(ctxHeaders(tenantId, userId))
        .send({ name: `CP1 CF Client ${uuidv7().slice(0, 8)}` });
      expect(c.status).toBe(201);
      const clientId = c.body.data.id as string;

      const def = await request(app)
        .post("/api/v1/custom-fields")
        .set(apiHeaders(tenantId, userId))
        .send({
          entity_type: "event",
          field_key: fieldKey,
          label: "Region",
          field_type: "text",
          is_required: false,
        });
      expect(def.status).toBe(201);

      const ev = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantId, userId))
        .send({
          name: `CP1 CF Event ${uuidv7().slice(0, 8)}`,
          client_id: clientId,
          start_date: "2026-11-01",
          end_date: "2026-11-02",
          custom_fields: { [fieldKey]: "Southeast" },
        });
      expect(ev.status).toBe(201);
      const eventId = ev.body.data.id as string;
      expect(ev.body.data.custom_fields?.[fieldKey]).toBe("Southeast");

      const get = await request(app)
        .get(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantId, userId));
      expect(get.status).toBe(200);
      expect(get.body.data.custom_fields?.[fieldKey]).toBe("Southeast");

      const put = await request(app)
        .put(`/api/v1/events/${eventId}`)
        .set(ctxHeaders(tenantId, userId))
        .send({
          custom_fields: { [fieldKey]: "Northwest" },
          updated_at: get.body.data.updated_at,
        });
      expect(put.status).toBe(200);
      expect(put.body.data.custom_fields?.[fieldKey]).toBe("Northwest");
    });
  });

  describe("Category D — domain events", () => {
    it("event.created and personnel.created fire", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();

      const busEvents: string[] = [];
      const h1 = (p: unknown) => {
        busEvents.push("event.created");
        expect(p).toMatchObject({ tenant_id: tenantId });
      };
      domainBus.on("event.created", h1);

      const personnelSeen: string[] = [];
      const off = onEvent("personnel.created", () => {
        personnelSeen.push("personnel.created");
      });

      try {
        const c = await request(app)
          .post("/api/v1/clients")
          .set(ctxHeaders(tenantId, userId))
          .send({ name: `CP1 Bus Client ${uuidv7().slice(0, 8)}` });
        expect(c.status).toBe(201);

        const ev = await request(app)
          .post("/api/v1/events")
          .set(ctxHeaders(tenantId, userId))
          .send({
            name: `CP1 Bus Event ${uuidv7().slice(0, 8)}`,
            client_id: c.body.data.id,
            start_date: "2026-12-01",
            end_date: "2026-12-02",
          });
        expect(ev.status).toBe(201);
        expect(busEvents).toContain("event.created");

        const p = await request(app)
          .post("/api/v1/personnel")
          .set(apiHeaders(tenantId, userId))
          .send({
            first_name: "Bus",
            last_name: "Test",
            email: `bus-${uuidv7().slice(0, 8)}@example.com`,
            role: "Rigger",
            employment_type: "contractor",
          });
        expect(p.status).toBe(201);
        expect(personnelSeen).toContain("personnel.created");
      } finally {
        domainBus.off("event.created", h1);
        off();
      }
    });

    it("truck.created and fieldDefinition.created fire", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();

      const trucks: string[] = [];
      const hTruck = () => trucks.push("truck.created");
      domainBus.on("truck.created", hTruck);

      const fields: string[] = [];
      const hField = () => fields.push(FIELD_DEFINITION_CREATED);
      domainBus.on(FIELD_DEFINITION_CREATED, hField);

      try {
        const t = await request(app)
          .post("/api/v1/trucks")
          .set(apiHeaders(tenantId, userId))
          .send({
            name: `CP1 Bus Truck ${uuidv7().slice(0, 8)}`,
            type: "sprinter_van",
            status: "available",
          });
        expect(t.status).toBe(201);
        expect(trucks).toContain("truck.created");

        const fk = `fd_${uuidv7().slice(0, 8)}`;
        const d = await request(app)
          .post("/api/v1/custom-fields")
          .set(apiHeaders(tenantId, userId))
          .send({
            entity_type: "event",
            field_key: fk,
            label: "FD test",
            field_type: "text",
            is_required: false,
          });
        expect(d.status).toBe(201);
        expect(fields).toContain(FIELD_DEFINITION_CREATED);
      } finally {
        domainBus.off("truck.created", hTruck);
        domainBus.off(FIELD_DEFINITION_CREATED, hField);
      }
    });
  });

  describe("Category E — events slice", () => {
    it("phase transition and clone", async () => {
      if (!okDb) return;
      const tenantId = uuidv7();
      const userId = uuidv7();

      const c = await request(app)
        .post("/api/v1/clients")
        .set(ctxHeaders(tenantId, userId))
        .send({ name: `CP1 Phase Client ${uuidv7().slice(0, 8)}` });
      expect(c.status).toBe(201);

      const ev = await request(app)
        .post("/api/v1/events")
        .set(ctxHeaders(tenantId, userId))
        .send({
          name: `CP1 Phase ${uuidv7().slice(0, 8)}`,
          client_id: c.body.data.id,
          start_date: "2027-01-10",
          end_date: "2027-01-12",
          phase: "planning",
        });
      expect(ev.status).toBe(201);
      const id = ev.body.data.id as string;

      const phases = ["pre_production", "production", "post_production", "closed"] as const;
      for (const ph of phases) {
        const tr = await request(app)
          .put(`/api/v1/events/${id}/phase`)
          .set(ctxHeaders(tenantId, userId))
          .send({ phase: ph, notes: null });
        expect(tr.status).toBe(200);
        expect(tr.body.data.phase).toBe(ph);
      }

      const cloneName = `CP1 Phase ${uuidv7().slice(0, 8)} (copy)`;
      const clone = await request(app)
        .post(`/api/v1/events/${id}/clone`)
        .set(ctxHeaders(tenantId, userId))
        .send({
          name: cloneName,
          start_date: "2027-02-01",
          end_date: "2027-02-03",
        });
      expect(clone.status).toBe(201);
      expect(clone.body.data.id).not.toBe(id);
      expect(String(clone.body.data.name)).toBe(cloneName);

      const phaseBad = await request(app)
        .put(`/api/v1/events/${id}/phase`)
        .set(ctxHeaders(tenantId, userId))
        .send({ phase: "planning", notes: "nope" });
      expect(phaseBad.status).toBeGreaterThanOrEqual(400);
    });
  });
});
