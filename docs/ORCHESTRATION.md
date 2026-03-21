# Orchestration (human or Orchestrator agent)

Use the **Planning** repo (`planning-docs/master/orchestration/agents/orchestrator/`):

- `runbook.md` — pre-wave, during wave, checkpoints
- `master-checklist.md` — Wave 0–N tracking
- `integration-checkpoints.md` — cross-module verification

## Current repo state

This monorepo ships **Postgres-backed Express** (`backend/`), **Vite** UI at repo root (`index.html`, `js/`), **`shared/`** types, **`contracts/`**, CI, and Firebase optional paths. Many Planning waves are **partially** implemented in code; authoritative tracking lives in Planning `master-checklist.md`.

**In-repo engineering TODO:** [`docs/BACKLOG-TODO.md`](./BACKLOG-TODO.md). **Last reconciliation note:** [`docs/agent-reconciliation-2026-03-22.md`](./agent-reconciliation-2026-03-22.md).

**Still heavy lifts (summary):** formal checkpoint sign-off (human), integrations module, broader E2E, financial payments, scheduling views, analytics/collaboration depth — see Planning + `BACKLOG-TODO.md`.

## How to run a module agent in Cursor

1. Open **PLD-Monorepo** + **Planning** (multi-root workspace recommended).
2. Start a new agent/chat; attach `planning-docs/modules/<module>/context.md`, `contract.md`, `technical.md`.
3. Instruct: touch **only** `backend/src/modules/<module>/` and `frontend/src/modules/<module>/` (create `frontend/src/modules/` when Wave 1 starts).
4. Shared edits → Infra / Foundation per Planning `agents/infra/`.
