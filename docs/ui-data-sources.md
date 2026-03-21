# UI data sources (API vs local)

This summarizes what each major surface uses after the mock-data audit. **Contracts** in `contracts/*.contract.md` are authoritative for shapes and errors.

| Area | Source |
|------|--------|
| Sidebar company name, tenant initials | `GET /api/v1/tenant` (`js/pld-tenant-shell.js`), cached in `window.__pldTenant` |
| Top bar user initials | JWT user from `pldAuthGetUserJson()` (login payload); refreshed after `PUT /api/v1/auth/me` |
| Account page | `GET`/`PUT /api/v1/auth/me` (`js/auth-pages.js`) |
| Settings → General | `GET /api/v1/tenant` (full `settings` needs `tenancy.settings.view` or `*`); save: `PUT /api/v1/tenant` with `name` + `settings` (`default_timezone`, `default_currency`, `features.scheduling`, `features.data_export`) — requires `tenancy.settings.edit` |
| Financial overview — cost bars, by-category, recent rows | `GET /api/v1/reports/costs` (`group_by=category`), `GET /api/v1/financials` (`js/pld-financial-api.js`) |
| Financial — budget by event | Hydrated `EVENTS` (from catalog sync) |
| Dashboard KPIs | `EVENTS`, `PERSONNEL`, `ACTIVITY_LOG` from hydration; demo stat deltas removed |
| Dashboard finance invoice table | `INVOICES` from hydration |
| Notifications dropdown | `pld-notifications-api.js` when API returns rows; otherwise empty state (no fictional list) |
| Scheduling conflict banner | Empty until a conflicts API is wired (`contracts/scheduling.contract.md`) |
| Travel rooming tab | Demo blocks hidden when `PLD_DATA_FROM_REST`; use travel records + API |
| Documents print mockups | Tenant name from `__pldTenant`; event titles from first `EVENTS[]` row where applicable |
| Documents — template `{{variables}}` picker | `GET /api/v1/templates/variable-catalog` (see [template-variables.md](./template-variables.md)) |
| Event → Running Schedule grid | `event.metadata.running_schedule` (`cells` keyed by `rowKey|YYYY-MM-DD`, optional `phaseByDate`, `showDate`); persisted via `PUT /api/v1/events/:id` with merged `metadata` (`js/running-schedule.js`, `js/pld-events-sync.js`) |

## Dev identities

See `docs/bootstrap-dev-identity.md`. Migration `009_bootstrap_dev_identity.sql` adds the **test** tenant + lab user; `npm run db:seed` adds the **owner** user on the demo tenant when not present (`OWNER_EMAIL` / `PLD_DEV_OWNER_EMAIL`).
