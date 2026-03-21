import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { randomUUID } from "node:crypto";
import * as repo from "../src/modules/documents/repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, "../../database/migrations/003_documents_module.sql");

const conn =
  process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";

describe("documents tenant isolation (Postgres)", () => {
  let pool: pg.Pool;
  let skip = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: conn });
    try {
      const check = await pool.query(`SELECT to_regclass('public.documents') AS t`);
      if (!check.rows[0]?.t) {
        const sql = readFileSync(migrationPath, "utf8");
        await pool.query(sql);
      }
    } catch (e) {
      console.warn("Skipping documents integration tests (DB unavailable):", e);
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("list returns only same-tenant rows", async function () {
    if (skip) return;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const user = randomUUID();
    const idA = randomUUID();
    const idB = randomUUID();
    await repo.insertDocument(pool, {
      id: idA,
      tenant_id: tenantA,
      event_id: null,
      entity_type: null,
      entity_id: null,
      category: "other",
      name: "A doc",
      description: null,
      source: "uploaded",
      visibility: "internal",
      mime_type: "text/plain",
      size_bytes: "1",
      storage_key: "x/a.txt",
      tags: [],
      generated_from_template_id: null,
      doc_version: 1,
      uploaded_by: user,
      processing_status: "complete",
    });
    await repo.insertDocument(pool, {
      id: idB,
      tenant_id: tenantB,
      event_id: null,
      entity_type: null,
      entity_id: null,
      category: "other",
      name: "B doc",
      description: null,
      source: "uploaded",
      visibility: "internal",
      mime_type: "text/plain",
      size_bytes: "1",
      storage_key: "x/b.txt",
      tags: [],
      generated_from_template_id: null,
      doc_version: 1,
      uploaded_by: user,
      processing_status: "complete",
    });
    const fromA = await repo.listDocuments(pool, tenantA, {
      sort_by: "created_at",
      sort_order: "desc",
      limit: 50,
      cursor: null,
    });
    expect(fromA.rows.some((r) => r.id === idA)).toBe(true);
    expect(fromA.rows.some((r) => r.id === idB)).toBe(false);
    const one = await repo.getDocumentById(pool, tenantA, idB);
    expect(one).toBeNull();
  });
});
