# Agent ↔ section map

See Planning `master/vision/system-architecture.md` and `master/orchestration/phased-roadmap.md`.

| Wave | Agent | Module folder(s) | Planning `modules/` |
|------|-------|-------------------|---------------------|
| 0 | **Foundation** | `backend/src/core/`, `shared/`, `contracts/`, `database/`, `.cursor/rules/` | — |
| 0 | **Infra** (on demand) | shared paths above | — |
| 1 | **A** | `events/` | `events/` |
| 1 | **B** | `personnel/` | `personnel/` |
| 1 | **C** | `trucks/` | `trucks/` |
| 1 | **D** | `custom-fields/` | `custom-fields/` |
| 2 | **A** | `scheduling/` | `scheduling/` |
| 2 | **B** | `travel/` | `travel/` |
| 2 | **C** | `financial/` | `financial/` |
| 2 | **D** | `documents/` | `documents/` |
| 3+ | split | `analytics/`, `collaboration/`, `search/`, `integrations/` | same |
| 0–1 | **Auth / Tenancy** | `auth/`, `tenancy/` | `auth/`, `tenancy/` (often Foundation) |

**Rule:** one agent session = one module (or Foundation/Infra). No cross-module edits without Orchestrator / Infra routing.
