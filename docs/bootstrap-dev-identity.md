# Dev bootstrap identity (pre-production)

This captures the agreed strategy for replacing UI mock data with **real tenants and users** while keeping **one fixed owner** and **one lab tenant** for empty databases. **Rotate passwords and emails before production**; do not ship `pld` or test addresses to prod.

## Goals

1. **Single master owner** — one account that conceptually “owns” the service for dev/testing. Email: **`Cody@paragonlivedesign.com`** (set in one place in seed/migration or `OWNER_EMAIL`; login may normalize case). This is the **only** long-lived fixed identity in bootstrap (everything else comes from the API/DB).
2. **Password (dev only)** — `pld` for bootstrap users until you change it.
3. **Test tenant + test user** — when the DB has no tenants/users, migrations/seeds must create:
   - A **tenant** (e.g. display name “Test Tenant”, slug `test` or `test-tenant` — exact slug TBD in migration).
   - A **non-owner** user **`testtenant@testtenant.com`** (or `test.tenant@testtenant.com` if you prefer) with the same dev password `pld`, scoped to that tenant, for everyday testing without using the owner account.
4. **Google authentication** — planned later; local email/password + JWT remains until then.
5. **Production** — replace bootstrap constants, rotate credentials, remove or guard dev-only seeds.

## What gets hardcoded (minimal surface)

| Item | Value | Notes |
|------|--------|--------|
| Master owner email | **`Cody@paragonlivedesign.com`** | Same value via `PLD_DEV_OWNER_EMAIL` / `OWNER_EMAIL` in seed or `.env` (preferred for forks); avoid duplicating elsewhere. |
| Dev password | `pld` | Same for owner + test user in dev seed only. |
| Test user email | `testtenant@testtenant.com` (or agreed variant) | Lab account under the test tenant. |

**Not** hardcoded: company name in the shell (comes from `GET /api/v1/tenant` after implementation), crew names, financial rows, etc.

## Implementation direction (when execution starts)

- **Database**: Extend Postgres seed/migrations (see `database/migrations`, `scripts/seed-postgres.mjs`) to:
  - Insert tenant row(s) for the test tenant.
  - Insert users with **bcrypt** (or existing auth hash) for password `pld`.
  - Grant owner user full permissions (`*` or platform role per `auth` module).

**Implemented:** `database/migrations/009_bootstrap_dev_identity.sql` (test tenant + `testtenant@testtenant.com`). `scripts/seed-postgres.mjs` inserts the owner on the demo tenant using `OWNER_EMAIL` / `PLD_DEV_OWNER_EMAIL` (default `cody@paragonlivedesign.com`), password `pld`.
- **SPA**: No need to embed your email in the **client** unless you want a dev-only login hint; prefer **server-side seed** only.
- **Security**: Prefer **`OWNER_EMAIL=Cody@paragonlivedesign.com`** in root `.env` (gitignored) for seeds so the address is not committed; if the email is hardcoded in a migration, document that public repos must use env-driven seed instead. Rotate `pld` before production.

## Relation to the mock-data removal plan

Phase A (tenant shell + profile) and Phase B (financial API) assume tenants/users exist. This document is the **prerequisite**: migrations + seed guarantee **at least** the owner + test tenant user so the app is usable on a fresh DB.

## Platform master admin (SPA)

The **Master admin** sidebar link and `GET /api/v1/platform/tenants` require the signed-in user’s email to appear in **`PLD_PLATFORM_ADMIN_EMAILS`** on the API (see `.env.example`). Add `Cody@paragonlivedesign.com` there for local dev. See [`contracts/platform.contract.md`](../contracts/platform.contract.md).

## Future: Google sign-in

When added, map Google identity to existing `users` rows (or invite flow); dev bootstrap users remain for local/offline testing if desired, or are disabled in production via env.
