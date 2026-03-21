/**
 * Integration smoke tests against a running API + Postgres.
 * Start Postgres + `npm run db:migrate`, then `npm run dev -w backend`, then:
 *   PLD_TEST_API=http://127.0.0.1:3000 npm run test:api
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const base = (process.env.PLD_TEST_API || "").replace(/\/$/, "");
const tenant = process.env.PLD_TEST_TENANT_ID || "00000000-0000-0000-0000-000000000001";
const user = process.env.PLD_TEST_USER_ID || "00000000-0000-0000-0000-000000000002";

function hdr() {
  return {
    "Content-Type": "application/json",
    "X-Tenant-Id": tenant,
    "X-User-Id": user,
    "X-Permissions": "*",
  };
}

async function tryFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

test("GET /health", async (t) => {
  if (!base) {
    t.skip("Set PLD_TEST_API (e.g. http://127.0.0.1:3000)");
    return;
  }
  const r = await tryFetch(`${base}/health`);
  if (!r) {
    t.skip("API not reachable — start backend first");
    return;
  }
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.data?.ok);
});

test("GET /api/v1/trucks returns envelope", async (t) => {
  if (!base) {
    t.skip("Set PLD_TEST_API");
    return;
  }
  const r = await tryFetch(`${base}/api/v1/trucks?limit=5`, { headers: hdr() });
  if (!r) {
    t.skip("API not reachable");
    return;
  }
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(Array.isArray(j.data));
  assert.ok(j.meta && typeof j.meta.total_count === "number");
  assert.equal(j.errors, null);
});

test("POST /api/v1/trucks create truck", async (t) => {
  if (!base) {
    t.skip("Set PLD_TEST_API");
    return;
  }
  const name = `Test Truck ${Date.now()}`;
  const r = await tryFetch(`${base}/api/v1/trucks`, {
    method: "POST",
    headers: hdr(),
    body: JSON.stringify({
      name,
      type: "box_truck",
      status: "available",
    }),
  });
  if (!r) {
    t.skip("API not reachable");
    return;
  }
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.ok(j.data?.id);
  assert.equal(j.data.name, name);
});
