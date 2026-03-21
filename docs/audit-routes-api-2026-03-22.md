# PLD_PM route and API audit (2026-03-22)

Canonical **client routes**, **API path inventory** aligned with [`backend/src/app-factory.ts`](../backend/src/app-factory.ts), **Vitest coverage** pointers, **known UI stubs**, and a **manual QA checklist** (mark rows as you verify).

**Maintenance (plan track A):** Periodically re-run [`npm run audit:extract-api-paths`](../package.json) and align §2 with [`backend/src/app-factory.ts`](../backend/src/app-factory.ts). **Last inventory refresh:** 2026-03-21 — **73** unique `/api/v1/...` string literals from **48** files under `js/` (script skips template literals that contain `${`).

## Environment (fair audit)

| Item | Notes |
|------|--------|
| API base | [`index.html`](../index.html) meta `pld-api-base` (e.g. `http://127.0.0.1:3000`) sets `window.PLD_API_BASE` in [`js/pld-api.js`](../js/pld-api.js). Empty = same-origin (Vite proxy). |
| CORS | Backend [`parseCorsOrigins()`](../backend/src/app-factory.ts) — include your static file or Vite origin. |
| Auth modes | **JWT**: `pld-auth-session.js` + `Authorization` + `X-Tenant-Id` from token. **Dev headers**: `X-Tenant-Id`, `X-User-Id`, `X-Permissions: *` when no Bearer (see `pld-api.js`). RBAC changes which actions succeed. |
| SPA routing | [`js/navigation.js`](../js/navigation.js) `navigateTo` + [`js/router.js`](../js/router.js) `renderPage` — URLs are not used for app pages (`history.replaceState` clears path). Query: `?page=reset-password` \| `invite-accept` ([`js/init.js`](../js/init.js)). |

## 1. Canonical client routes (`renderPage` switch)

Source: [`js/router.js`](../js/router.js). Default unknown id → “Page not found”.

| Page id | Render function | Sidebar / entry |
|---------|-----------------|-----------------|
| `dashboard` | `renderDashboard` | `index.html` nav `data-page="dashboard"` |
| `events` | `renderEvents` | Sidebar |
| `scheduling` | `renderScheduling` | Sidebar |
| `event` | `renderEventPage` | `navigateToEvent(id)`, lists, calendar, command palette |
| `personnel` | `renderPersonnel` | Sidebar |
| `trucks` | `renderTrucks` | Sidebar |
| `travel` | `renderTravel` | Sidebar |
| `financial` | `renderFinancial` | Sidebar |
| `documents` | `renderDocuments` | Sidebar |
| `clients` | `renderClients` | Sidebar |
| `venues` | `renderVenues` | Sidebar |
| `vendors` | `renderVendors` | Sidebar |
| `settings` | `renderSettings` | Sidebar |
| `search` | `renderSearchPage` | Command palette → full search ([`js/command-palette.js`](../js/command-palette.js)), topbar search |
| `platform-admin` | `renderPlatformAdmin` | Hidden nav + topbar when platform admin ([`js/platform-admin.js`](../js/platform-admin.js)) |
| `login` | `renderAuthLogin` | Session / API bar, auth flows |
| `forgot-password` | `renderAuthForgotPassword` | From login |
| `reset-password` | `renderAuthResetPassword` | `?page=reset-password` or link |
| `invite-accept` | `renderAuthInviteAccept` | `?page=invite-accept` |
| `account` | `renderAuthAccount` | e.g. [`js/profile.js`](../js/profile.js) |
| `invite-user` | `renderAuthInviteAdmin` | Admin invite UI |

**Also referenced:** `navigateTo('clients')` from events modal ([`js/events.js`](../js/events.js)); dashboard / profile shortcuts ([`js/dashboard.js`](../js/dashboard.js), [`js/profile.js`](../js/profile.js)); topbar → `settings` / `login` ([`js/topbar.js`](../js/topbar.js)).

## 2. Client API prefixes → backend mounts

Express mounts from [`backend/src/app-factory.ts`](../backend/src/app-factory.ts). Below: **prefixes used from `js/`** (via `pldApiFetch`, `fetch`, or dynamic strings) and **server mount** — no orphan prefixes were found in the 2026-03-22 pass; literal-path counts re-checked 2026-03-21 (see header).

| Prefix (under `/api/v1`) | Server mount / notes |
|--------------------------|----------------------|
| `/health`, `/` | `app.get` |
| `/auth/*` | `authPublicRouter` + `authProtectedRouter` (includes **`POST /auth/invitations/accept`** — auth-layer user signup with password + token; see [`js/auth-pages.js`](../js/auth-pages.js)) |
| `/platform/*` | `platformRouter` |
| `/invitations/accept` | `app.post` — **personnel** invite accept (`personnelService.acceptInvitation`, token in body); distinct from **`/auth/invitations/accept`** (different tables / response shape) |
| `/events` (+ financial nested) | `eventsRouter` + `eventFinancialRouter` |
| `/clients`, `/venues`, `/vendors`, `/tasks`, `/me`, `/time`, `/pay-periods`, `/payroll`, `/travel`, `/search`, `/dashboard`, `/notifications` | `apiV1Ctx` router ([`tasksRouter`](../backend/src/modules/tasks/routes.ts)) |
| `/personnel`, `/departments`, `/invitations` | Separate `app.use` lines |
| `/tenant` | `tenantRouter` |
| `/custom-fields`, `/financials`, `/invoices`, `/reports/*` | `app.use` |
| `/assignments`, `/conflicts`, `/schedule` | Scheduling |
| `/trucks`, `/truck-routes` | Trucks |
| `/documents`, `/templates`, `/rider-items`, `/email-drafts` | Documents |
| `/audit-logs` | Audit |
| `/truck-routes/public/:token` | Public `app.get` |

**Dynamic / sub-resource examples** (all match module routers; not all appear in the static extract when built with template literals): `GET/POST /clients/:id/contacts`, `GET/PUT /events/:id`, `GET /events/:id/travel`, `POST /events/:id/phase`, `POST /events/:id/clone`, `POST /personnel/import/*`, `GET /me/crew-assignments`, `GET /templates/variable-catalog`, `POST /documents/upload`, `POST /truck-routes/:id/compute-route`, `POST /truck-routes/:id/share`, etc.

**Regenerate path list:** `npm run audit:extract-api-paths` ([`scripts/audit-extract-api-paths.mjs`](../scripts/audit-extract-api-paths.mjs)) — outputs sorted literals only; for dynamic URLs, search `js/` for `pldApiFetch` and template literals that interpolate IDs after `/api/v1/`.

## 3. Backend Vitest coverage (API confidence)

Run: `npm test` (workspace `backend` Vitest). Map UI/module → tests:

| UI / domain | Example test files |
|-------------|-------------------|
| Auth | `backend/tests/auth.api.test.ts`, `auth.unit.test.ts` |
| Events / CRM | `events.integration.test.ts`, `crm.integration.test.ts` |
| Personnel | `personnel.api.test.ts`, `personnel.integration.test.ts`, `personnel.unit.test.ts` |
| Trucks | `trucks-api.test.mjs` (API), integration via other suites |
| Documents | `documents.tenant-isolation.test.ts`, `template-merge-catalog.test.ts` |
| Financial | `financial.tenant-isolation.test.ts`, `financial.recalc.integration.test.ts`, `reports.costs.integration.test.ts` |
| Scheduling | `scheduling.integration.test.ts` |
| Travel / search | `travel-search.tenant-isolation.test.ts` |
| Notifications | `notifications.integration.test.ts` |
| Audit | `audit.integration.test.ts` |
| Tenancy | `tenancy.isolation.test.ts`, `tenant-settings.unit.test.ts` |
| Checkpoints | `checkpoint1.api.integration.test.ts`, `checkpoint2*.integration.test.ts` |

## 4. Known UI stubs / “coming soon” (grep)

| Location | Behavior |
|----------|----------|
| [`js/event-page.js`](../js/event-page.js) | Riders tab: copy explains rider lines come from Documents/API (no fake “Add Item” button) |
| [`js/dashboard.js`](../js/dashboard.js) | (removed) “Confirm availability” placeholder |
| [`js/settings.js`](../js/settings.js) | Workforce “Run export stub” → `pldPayrollExportStub` / `GET /api/v1/payroll/export` wrapper in [`js/pld-crm-api.js`](../js/pld-crm-api.js) |
| [`js/documents.js`](../js/documents.js) | Template placeholders `schedule_section`, `travel_section`, `financial_section` marked `stub` in catalog UI |

## 5. Automated smoke

- **Playwright:** [`tests/e2e/routes-smoke.spec.js`](../tests/e2e/routes-smoke.spec.js) — each canonical page id navigates via `navigateTo`, asserts `#pageContent` is non-empty and does not show router “Page not found”.
- **Playwright config** ([`playwright.config.js`](../playwright.config.js)):
  - **Default:** Vite on `127.0.0.1:5199` (override with `PLD_E2E_VITE_PORT`) — no Firebase required.
  - **`PLD_E2E_SQL=1`:** `npm run dev` on port 5173 (API + UI).
  - **`PLD_E2E_FIREBASE=1`:** Firebase Hosting emulator on port 5000 (legacy).
- **API errors in browser:** Route tests do not fail on `pldApiFetch` “Failed to fetch” when the backend is down; use `PLD_E2E_SQL=1` with a running API for full-stack smoke.

## 5b. Manual checklist execution status

Manual rows in §6 are left blank for you to fill during QA sessions. Initial automated pass: **28/28** Playwright tests passed (full `tests/e2e` suite) with default Vite webServer on port **5199** (`PLD_E2E_VITE_PORT`).

## 6. Manual QA checklist (tabs, modals, deep actions)

Use **Status:** `OK` | `Stub` | `Broken` | `Not wired` | `N/A`.

| Module | What to exercise | Key API / notes | Status |
|--------|------------------|-----------------|--------|
| Dashboard | Stat cards, dept schedule, links to Events/Scheduling/Personnel/Financial | `pldHydrateDashboardFromApi` → `/api/v1/dashboard/operations` | |
| Events | List, create/edit, clone, phase, context menu, open event | `/api/v1/events`, assignments | |
| Event detail | Tabs: overview, crew, trucks, running, schedule, travel, financial, documents, riders | `/api/v1/assignments/*`, `/events/:id/travel`, `+ Add Item` = stub | |
| Scheduling | Timeline / calendar / API sheet, conflicts | `/api/v1/schedule`, `/api/v1/conflicts` | |
| Personnel | List, create, detail, availability grid, photo upload | `/api/v1/personnel`, `/personnel/availability`, `/documents/upload` | |
| Trucks | List, routes, compute, share link, Maps | `/api/v1/trucks`, `/truck-routes` | |
| Travel | Global list, event travel | `/api/v1/travel` | |
| Financial | Cost breakdown, financial lines | `/api/v1/reports/costs`, `/api/v1/financials` | |
| Documents | List, upload, generate, templates | `/api/v1/documents`, `/templates` | |
| Clients / Venues / Vendors | CRUD, contacts | `/api/v1/clients`, `/venues`, `/vendors`, nested contacts | |
| Settings | General (tenant name), custom fields, workforce, payroll stub | `PUT /api/v1/tenant`, `/api/v1/custom-fields` | |
| Auth | Login, forgot/reset, invite accept, account, invite user | `/api/v1/auth/*` | |
| Search | Command palette + full search page | `/api/v1/search` | |
| Platform admin | Tenant list (if allowed) | `/api/v1/platform/tenants` | |
| Notifications | Panel, mark read, preferences | `/api/v1/notifications` | |

---

*Generated by the audit implementation; update Status column as you complete manual QA.*
