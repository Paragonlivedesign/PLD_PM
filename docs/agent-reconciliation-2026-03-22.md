# Agent reconciliation — CP1 / CP2 tracking (2026-03-22)

This note supplements Planning `planning-docs/master/orchestration/checkpoint-1-verification-record.md` and `checkpoint-2-verification-record.md` (separate Planning workspace).

## Doc map

| Doc | Purpose |
|-----|---------|
| [`BACKLOG-TODO.md`](./BACKLOG-TODO.md) | **Engineering TODO** checklist (gates, waves, docs hygiene) |
| [`WAVE3-BACKLOG.md`](./WAVE3-BACKLOG.md) | Wave 3 scope notes |
| [`WAVE4-RUNBOOK.md`](./WAVE4-RUNBOOK.md) | CP4 / integrations / E2E order |
| [`ORCHESTRATION.md`](./ORCHESTRATION.md) | Pointers to Planning orchestration + repo state |
| [`emulators-and-testing.md`](./emulators-and-testing.md) | Firebase + test commands |

## Automated coverage (PLD_PM)

- **CP0.3-style register:** `POST /api/v1/auth/register` + test in `backend/tests/auth.api.test.ts`.
- **Audit:** `writeAuditLog` extended to major Wave 1 mutating paths (events, clients, venues, personnel, trucks) and user registration.
- **Personnel custom fields:** API `custom_fields` on read/update with validation; UI mount on PostgreSQL personnel profile modal.
- **Scheduling UI:** `GET /api/v1/conflicts?status=active` drives the scheduling page conflict summary when API base is set.
- **Search:** Dedicated `search` route + `js/pld-search-page.js`; command palette links “View all API results.”
- **Context menus:** `js/pld-context-menu.js` — Events table, Personnel cards, Trucks / Clients / Venues rows.
- **Custom fields admin:** Edit modal, reorder (↑/↓), Deactivate label; **truck** entity in API + `trucks.custom_fields` + truck detail modal saves via `PUT /api/v1/trucks/:id`.
- **Search index:** Clients and venues rows sync on create/update/delete; truck searchable CF folded into `syncTruckSearchRow`.
- **Documents:** API document preview embeds PDF in an `<iframe>` when `mime_type` is PDF and a signed download URL exists.

## Regression runs (automated)

- **2026-03-22:** `npm run db:migrate` then `npm run test:cp1` — **14/14 passed** (`tests/checkpoint1.api.integration.test.ts`).
- **2026-03-22:** `npm run test:cp2` — **10/10 passed** across `checkpoint2.workflow`, `checkpoint2.categories`, `checkpoint2-wave2-contracts` integration tests.

## Still manual / Orchestrator-owned

- Formal **Checkpoint 1** and **Checkpoint 2** sign-off rows unchanged where Planning lists waivers or Category F UI.
- **Category F** Playwright breadth, **field-level auth** middleware, **integrations** module, and **Wave 4** assembly remain backlog (see `docs/WAVE4-RUNBOOK.md`).
