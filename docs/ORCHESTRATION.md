# Orchestration (human or Orchestrator agent)

Use the **Planning** repo (`planning-docs/master/orchestration/agents/orchestrator/`):

- `runbook.md` — pre-wave, during wave, checkpoints
- `master-checklist.md` — Wave 0–N tracking
- `integration-checkpoints.md` — cross-module verification

## Current repo state

This monorepo is **Wave 0 started**: scaffold, contracts copied, minimal API + Vite shell, Docker for Postgres/Redis, CI build, Cursor rules.

**Next:** Foundation Agent completes auth, tenancy, migrations, envelope middleware, domain event bus, and `shared/types` from `domain-model.md`.

**Then:** Checkpoint 0 → **Wave 1** parallel agents (Events, Personnel, Trucks, Custom Fields) per `phased-roadmap.md`.

## How to run a module agent in Cursor

1. Open **PLD-Monorepo** + **Planning** (multi-root workspace recommended).
2. Start a new agent/chat; attach `planning-docs/modules/<module>/context.md`, `contract.md`, `technical.md`.
3. Instruct: touch **only** `backend/src/modules/<module>/` and `frontend/src/modules/<module>/` (create `frontend/src/modules/` when Wave 1 starts).
4. Shared edits → Infra / Foundation per Planning `agents/infra/`.
