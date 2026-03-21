# Engineering backlog — TODO checklist

Living list of **next** work after the 2026-03-22 reconciliation pass. For checkpoint status and waivers, see [`agent-reconciliation-2026-03-22.md`](./agent-reconciliation-2026-03-22.md) and the Planning repo `planning-docs/master/orchestration/`.

## Gates & verification

- [ ] **Orchestrator sign-off:** formal CP1 / CP2 closure where Planning still lists waivers or Category F UI (human).
- [ ] **Regression on each merge:** `npm run db:migrate` → `npm run test:cp1` → `npm run test:cp2` (and full `npm run test -w backend` before risky merges).
- [ ] **Playwright:** widen `tests/e2e/*.spec.js` beyond smoke (auth + one critical path: event → assign → financial).

## Wave 1 / UX polish

- [ ] **Context menus:** extend to more surfaces (scheduling grid, vendors, financial tables) using `js/pld-context-menu.js`.
- [ ] **Custom fields:** `show_in_table` / list columns when contract + API add the flag; select/multi-select options editor in Settings UI.

## Wave 2

- [ ] **Scheduling:** extra views (by crew / truck / event / dept); dashboard month card; drive-time conflict UX.
- [ ] **Financial:** payment workflow state machine + payment UI (per Planning `modules/financial/checklist.md`).
- [ ] **Travel:** polish global list, rooming, itinerary (per module status).

## Wave 3

- [ ] **Analytics:** report engine, report CRUD, crew/truck utilization UI, PDF export for reports.
- [ ] **Collaboration:** JWT parity with REST on WebSocket; domain event → WS broadcast; presence + activity feed.

## Wave 4

- [ ] **Integrations:** implement `contracts/integrations.contract.md` + tests (see [`WAVE4-RUNBOOK.md`](./WAVE4-RUNBOOK.md)).
- [ ] **Deploy:** env matrix + optional CI deploy job; performance budgets (optional k6).

## Docs hygiene

- [ ] After each feature slice: bump **Last Updated** in Planning `master-checklist.md` if behavior changes.
- [ ] Keep this file in sync when closing a major TODO (check boxes + add new rows as needed).
