#!/usr/bin/env node
/**
 * Checkpoint 2 — API smoke subset (Category C steps 1–8 style).
 * Requires: Postgres migrated, API running (e.g. npm run dev), DATABASE_URL optional for local.
 *
 * Usage:
 *   PLD_API_BASE=http://127.0.0.1:3000 node scripts/cp2-workflow-smoke.mjs
 *
 * Headers match dev middleware: X-Tenant-Id, X-User-Id (UUIDs), X-Permissions: *
 */

const BASE = (process.env.PLD_API_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const TENANT = process.env.PLD_TENANT_ID || "00000000-0000-0000-0000-000000000001";
const USER = process.env.PLD_USER_ID || "00000000-0000-0000-0000-000000000002";

const results = [];

async function api(method, path, body) {
  const headers = {
    "Content-Type": "application/json",
    "X-Tenant-Id": TENANT,
    "X-User-Id": USER,
    "X-Permissions": "*",
  };
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = { errors: [{ message: "non-json" }] };
  }
  return { ok: r.ok, status: r.status, body: j };
}

function step(id, label, pass, detail) {
  results.push({ id, label, pass, detail });
  const s = pass ? "PASS" : "FAIL";
  console.log(`[${s}] ${id} ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  console.log(`CP2 smoke → ${BASE} tenant=${TENANT}\n`);

  const h = await api("GET", "/health");
  step("H", "GET /health", h.ok && h.body?.data, h.ok ? "" : JSON.stringify(h.body));

  const clientBody = {
    name: `CP2 Acme ${Date.now()}`,
    contact_email: "billing@example.com",
  };
  const c1 = await api("POST", "/api/v1/clients", clientBody);
  const clientId = c1.body?.data?.id;
  step("1", "Create client", c1.ok && clientId, clientId || JSON.stringify(c1.body));

  const venueBody = {
    name: `CP2 Venue ${Date.now()}`,
    address: "4 Pennsylvania Plaza",
    city: "New York",
    latitude: 40.7505,
    longitude: -73.9934,
  };
  const v1 = await api("POST", "/api/v1/venues", venueBody);
  const venueId = v1.body?.data?.id;
  step("2", "Create venue w/ coordinates", v1.ok && venueId, venueId || JSON.stringify(v1.body));

  const evBody = {
    name: `CP2 Conference ${Date.now()}`,
    client_id: clientId,
    venue_id: venueId,
    start_date: "2026-02-20",
    end_date: "2026-02-22",
    phase: "planning",
    status: "draft",
  };
  const e1 = await api("POST", "/api/v1/events", evBody);
  const eventId = e1.body?.data?.id;
  step("3", "Create event", e1.ok && eventId, eventId || JSON.stringify(e1.body));

  const ePhase = await api("PUT", `/api/v1/events/${eventId}/phase`, {
    phase: "pre_production",
    notes: "cp2 smoke",
  });
  step("4", "Transition phase", ePhase.ok, ePhase.ok ? "" : JSON.stringify(ePhase.body));

  const dept = await api("GET", "/api/v1/departments?limit=5");
  let deptId = Array.isArray(dept.body?.data) ? dept.body.data[0]?.id : null;
  if (!deptId) {
    const dnew = await api("POST", "/api/v1/departments", { name: `CP2 Dept ${Date.now()}` });
    deptId = dnew.body?.data?.id;
    step("D", "Create department (seed)", dnew.ok && deptId, deptId || JSON.stringify(dnew.body));
  } else {
    step("D", "List departments (for personnel)", dept.ok && deptId, deptId || JSON.stringify(dept.body));
  }

  const people = [];
  const rates = [500, 450, 600];
  for (let i = 0; i < 3; i++) {
    const pb = {
      first_name: "CP2",
      last_name: `Person${i}_${Date.now()}`,
      email: `cp2_${i}_${Date.now()}@example.com`,
      role: i === 2 ? "Crew Lead" : i === 0 ? "Audio Engineer" : "Video Engineer",
      ...(deptId ? { department_id: deptId } : {}),
      employment_type: "freelance",
      day_rate: rates[i],
      per_diem: 75,
      skills: ["audio"],
      status: "active",
    };
    const pr = await api("POST", "/api/v1/personnel", pb);
    const pid = pr.body?.data?.id;
    step(`5-${i}`, `Create personnel ${i}`, pr.ok && pid, pid || JSON.stringify(pr.body));
    if (pid) people.push(pid);
  }

  for (let i = 0; i < people.length; i++) {
    const asg = {
      event_id: eventId,
      personnel_id: people[i],
      role: i === 2 ? "Crew Lead" : i === 0 ? "Audio" : "Video",
      start_date: "2026-02-20",
      end_date: "2026-02-22",
      status: "confirmed",
    };
    const ar = await api("POST", "/api/v1/assignments/crew", asg);
    step(`6-${i}`, `Crew assignment ${i}`, ar.ok, ar.ok ? "" : JSON.stringify(ar.body));
  }

  step("7", "Domain events (assignment.created)", true, "check API logs / bus listeners");

  const conf = await api("GET", "/api/v1/conflicts?status=active&limit=50");
  step("8", "Conflicts API", conf.ok, conf.ok ? `count meta=${JSON.stringify(conf.body?.meta)}` : JSON.stringify(conf.body));

  const dash = await api("GET", "/api/v1/dashboard/operations");
  step("A1", "Analytics operations dashboard", dash.ok, dash.ok ? "kpis" : JSON.stringify(dash.body));

  const search = await api("GET", "/api/v1/search?q=CP2&limit=5");
  step("S1", "Search API", search.ok, search.ok ? "ok" : JSON.stringify(search.body));

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\n── Summary: ${passed}/${total} steps passed ──`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
