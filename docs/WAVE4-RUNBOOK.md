# Wave 4 — integration, assembly, E2E (runbook stub)

Planning checkpoint **CP4** gates: full E2E, integrations, import/export, performance, deployable platform.

Cross-repo engineering checklist: [`BACKLOG-TODO.md`](./BACKLOG-TODO.md).

## Suggested order (when Wave 3 exits)

1. **Contract & API:** implement `contracts/integrations.contract.md` (or successor) with tenant-scoped routes and tests.
2. **E2E:** expand `tests/e2e/*.spec.js` beyond smoke — auth, one multi-step workflow per critical path (event → assign → financial line).
3. **Performance:** define budgets (p95 API, search index rebuild time); add a minimal k6 or scripted load smoke optional.
4. **Deploy:** document env matrix (`DATABASE_URL`, `JWT_SECRET`, `AUTH_ALLOW_PUBLIC_REGISTER`, `CORS_ORIGIN`) and CI deploy job.

## Repo pointers

- Planning: `planning-docs/master/orchestration/integration-checkpoints.md` § Checkpoint 4.
- CI: `.github/workflows/ci.yml`, `npm run test:e2e`, `npm run test:cp2`.
