# Firebase emulators, Firestore, Storage, and testing

All commands below assume repo root **`PLD_PM`** (`C:\Users\codya\Desktop\PLD_PM`): one tree for UI, Firebase config, `backend` / `shared` workspaces, and tests.

## Architecture

- **Default (API reachable):** On load, `js/pld-events-sync.js` calls `pldTryBootstrapFromSql()` — it probes `GET /api/v1/health` and hydrates all catalog arrays from PostgreSQL via REST (`pldHydrateCatalogFromRest`). **Firebase is not used** in that path.
- **Fallback:** If the API is down, `js/pld-firebase.js` loads **Firestore** (emulator or project) into the same globals in `data.js`, then may still overlay events/clients/venues from REST if `pldTrySyncEventsStackFromRest` succeeds.
- **Storage** is configured with `storage.rules` for `documents/**` and `uploads/**`. Upload flows can use `firebase.storage()`; metadata stays in Firestore `documents` collection.
- **Security rules** (`firestore.rules`, `storage.rules`): read/write only when `request.auth != null`. The app uses **anonymous sign-in** locally (and in the emulator) so rules pass without a full login UI yet.
- **Seed data** is defined in `scripts/seed-collections.mjs`; `npm run seed` runs `scripts/seed-firestore.mjs` against the **emulator** (via `FIRESTORE_EMULATOR_HOST` in the npm script) unless you change that intentionally.

## Prerequisites

- Node 20+
- **Java** (JRE 11+) for the Firestore emulator — [Adoptium](https://adoptium.net/) if the emulator fails to start.
- `npm install`

## API + Vite (no Firebase)

For the Express shell and Vite dev server only (no Firestore emulator):

```bash
npm run dev
```

- Backend default: see `backend` (typically port **3000**).
- Vite: http://127.0.0.1:5173  

Use this when you are not testing Firebase rules or Hosting.

### Postgres-only local (no Firebase emulators)

1. Start Postgres (e.g. Docker or native) and set `DATABASE_URL` for the backend.
2. `npm run db:migrate` from repo root.
3. `npm run dev` — starts the API (port **3000**) and Vite (port **5173**).
4. Open **http://127.0.0.1:5173** (or your hosted static shell with `<meta name="pld-api-base" content="http://127.0.0.1:3000">`). The app bootstraps entirely from the REST API; you do **not** need `npm run emulators` or `npm run seed`.

If the API is unreachable, the shell falls back to Firebase/Firestore when emulator config is present (see `js/pld-firebase.js`).

### PostgreSQL auth module (Wave 0)

- Apply migration `database/migrations/005_auth_module.sql` (adds `tenants`, `users`, `roles`, refresh tokens, invitations, etc.). Seeded demo tenant slug `demo` and user `admin@demo.local` / password `password`.
- **Bootstrap dev identities:** migration `009_bootstrap_dev_identity.sql` adds tenant slug `test` and user `testtenant@testtenant.com` (password `pld`). Run `npm run db:seed` to insert the **owner** user on the demo tenant; email from `OWNER_EMAIL` or `PLD_DEV_OWNER_EMAIL` in `.env` (default `cody@paragonlivedesign.com`), password `pld`. See `docs/bootstrap-dev-identity.md`.
- **JWT signing:** Implementation uses `jose` in `backend/src/modules/auth/jwt.ts`. If **`JWT_PRIVATE_KEY`** and **`JWT_PUBLIC_KEY`** are set (PEM strings), access tokens are **RS256**. If those are omitted, set **`JWT_SECRET`** so login can issue **HS256** access tokens (typical local dev). See root **`.env.example`**.
- **Redis (optional):** If **`REDIS_URL`** is set, `backend/src/modules/auth/cache.ts` stores resolved role **permissions** in Redis (short TTL) for multi-instance consistency; if Redis is down or unset, the API uses an in-process cache only.
- With `PLD_DEV_AUTH_HEADERS` unset or not `false`, API tests and tools may still send `X-Tenant-Id` + `X-User-Id` + optional `X-Permissions`.
- SPA: set `<meta name="pld-api-base" content="http://127.0.0.1:3000">` (or Vite proxy) and use **Sign in (API)** for JWT; `pldApiFetch` sends `Authorization: Bearer` and refreshes on 401.

### Checkpoint 2 API smoke (Postgres)

With Postgres migrated and `npm run dev` running:

```bash
set PLD_API_BASE=http://127.0.0.1:3000
npm run cp2:smoke
```

Creates client, venue, event, personnel, crew assignments; hits conflicts, dashboard, and search. Full Category C (27 steps) remains manual per Planning `integration-checkpoints.md`.

## Daily development (Firebase)

### 1. Start all emulators

```bash
npm run emulators
```

- Hosting: http://127.0.0.1:5000  
- Firestore: `127.0.0.1:8080`  
- Auth: `127.0.0.1:9099`  
- Storage: `127.0.0.1:9199`  
- Emulator UI: http://127.0.0.1:4000  

**Emulators already running?** You do **not** need a second stack. Leave `npm run emulators` (or your Firebase CLI session) as-is, then in another terminal run `npm run seed` and open http://127.0.0.1:5000 . Playwright (`npm run test:e2e`) is configured with **`reuseExistingServer: true`**: if something is already listening on port 5000, it will **not** try to start another Hosting emulator (avoids “port taken” errors).

### 2. Seed Firestore (after emulators are up)

New terminal:

```bash
npm run seed
```

This uses `FIRESTORE_EMULATOR_HOST` (set via `cross-env` in the npm script) so data goes to the **emulator**, not production.

### Clear emulator data (no re-seed)

```bash
npm run clear:firestore
```

Removes documents from the same collections the seed script uses. Requires emulators (or it will warn and target the configured GCP project).

### 3. Open the app

http://127.0.0.1:5000 — the shell loads Firestore, then renders.

If you see a red banner, emulators are not running or Firestore is empty / rules blocked sign-in.

### Personnel + PostgreSQL (real roster data)

`index.html` defaults to `<meta name="pld-api-base" content="http://127.0.0.1:3000">`, so the **Personnel** page lists crew from **PostgreSQL** via `GET /api/v1/personnel` (not the Firestore seed). Clear that `content` attribute if you want the Firestore-only demo roster.

1. Apply migrations and ensure `DATABASE_URL` is set (see `database/migrations`, `npm run db:migrate` from repo docs).
2. **Run the API** on port **3000** (e.g. `npm run dev` — runs API + Vite, or `npm run dev -w backend` for API only).
3. **CORS**: The backend accepts multiple origins in `CORS_ORIGIN` (comma-separated). Defaults include `http://127.0.0.1:5000` so the Firebase Hosting emulator can call the API. See `.env.example`.

Add people via `POST /api/v1/personnel`, the **Import CSV** flow, or your own scripts; then refresh Personnel.

## Deploy rules and indexes (real project)

Replace `js/firebase-config.js` with your **production** web app config from Firebase Console.

```bash
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Do **not** run `npm run seed` against production unless you intend to overwrite data (the script deletes collections first).

## Production Hosting

Hosting deploy still serves static files only. Ensure production `firebase-config.js` uses your real `apiKey`, `projectId`, etc. **Do not** use emulator connection on `pm.paragonlivedesign.com` (the app only attaches emulators on `localhost` / `127.0.0.1`).

## End-to-end tests

**Firebase stack** (default — starts emulators if not already running):

```bash
npm run test:e2e
```

**Postgres + Vite + API** (no Firebase — requires DB migrated and `npm run dev` stack):

```bash
set PLD_E2E_SQL=1
npm run test:e2e
```

CI runs `firebase emulators:exec` with `npm run seed` then Playwright unless you add a separate job for `PLD_E2E_SQL=1`.

## Wiping / resetting data

- **Emulator:** run `npm run seed` again (clears listed collections, then rewrites).
- **Or** use Emulator UI → Firestore → delete data.

## Updating seed content

Edit `scripts/seed-collections.mjs` (or regenerate from a spreadsheet later), then `npm run seed`.

## Regression notes (auth / financial / analytics permissions)

- **`GET /api/v1/tenant`:** Any authenticated context (JWT or dev headers) should return `200` with `data.name` for shell branding.
- **`PUT /api/v1/tenant`:** Expect `403` without `tenancy.settings.edit`; success updates sidebar after `pldRefreshTenantShell`.
- **`GET /api/v1/reports/costs`:** Requires `reports:read`; dev headers with `*` succeed in local smoke tests.
- **`GET /api/v1/financials`:** List endpoint used for recent rows; admin role with `*` passes.
- **`GET /api/v1/auth/me`:** Used implicitly via login payload for initials; Account page issues `PUT` for profile fields.
- **Analytics / dashboard API:** If migrations add permission checks, ensure demo admin retains expected roles or sign in again after `schema_migrations` changes (JWT caches permissions until refresh).

See also `docs/ui-data-sources.md` for a page-by-page mapping.
