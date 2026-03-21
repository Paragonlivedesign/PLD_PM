# PLD_PM

**Canonical project root:** `C:\Users\codya\Desktop\PLD_PM` — production management UI (static HTML/JS + Vite), Firebase (Firestore/Auth/Storage/Hosting), npm workspaces **`shared`** and **`backend`** (Express API shell), `contracts/`, and agent-oriented `.cursor/rules/`.

**Git:** [github.com/Paragonlivedesign/PLD_PM](https://github.com/Paragonlivedesign/PLD_PM).

**Deploy:** `https://pm.paragonlivedesign.com` (Firebase Hosting — second site). Hosting ignores exclude `backend/`, `shared/`, `contracts/`, and other non-static paths (see `firebase.json`).

## Local development

| Command | Purpose |
|--------|---------|
| `npm install` | Root + workspace dependencies |
| `npm run dev` | **Express API** (`backend`) + **Vite** dev server (default http://127.0.0.1:5173) for the UI at repo root |
| `npm run emulators` | Firebase Emulator Suite: Hosting http://127.0.0.1:5000 + Firestore, Auth, Storage, Emulator UI (needs **Java** for Firestore) |
| `npm run seed` | Second terminal while emulators are up — demo data into the **Firestore emulator** |
| `npm run build` | `shared` + `backend` TypeScript builds, then Vite production build + copy `js/` and `data.js` into `dist/` |
| `npm run typecheck` | Typecheck `shared` and `backend` |
| `npm run test:e2e` | Playwright — reuses Hosting on port 5000 if already running |
| `docker compose up -d postgres` | Local PostgreSQL (default `DATABASE_URL=postgresql://pld:pld@127.0.0.1:5432/pld_dev`) |
| `npm run db:migrate` | Apply `database/migrations/*.sql` (required before trucks/scheduling API) |
| `npm run db:seed` | Idempotent Postgres sample rows (clients/venues) for the demo tenant after migrate |

**Typical API + DB workflow:** `docker compose up -d postgres` → `npm run db:migrate` → `npm run db:seed` (optional) → `npm run dev` (Express + Vite). REST API health: `GET /health` or `GET /api/v1/health` (JSON envelope).
| `npm run test:api` | Smoke tests for REST API (`PLD_TEST_API=http://127.0.0.1:3000` to hit a running backend) |

The Vite dev server proxies `/api` to the backend (`vite.config.ts`). The Trucks module (`/api/v1/trucks`, `/api/v1/truck-routes`, `/api/v1/assignments/truck`) matches [`contracts/trucks.contract.md`](contracts/trucks.contract.md) and [`contracts/scheduling.contract.md`](contracts/scheduling.contract.md) (truck assignments).

Use **`npm run dev`** when you are exercising the modular API + Vite UI together. Use **`npm run emulators`** when you need the full Firebase stack (same origin as Hosting, anonymous auth against emulator, etc.).

Data in the Firebase flow is **Firestore** (loaded via `js/pld-firebase.js`); rules in `firestore.rules` / `storage.rules` require auth; the app uses **anonymous** sign-in on localhost.

Details: [docs/emulators-and-testing.md](docs/emulators-and-testing.md). Document merge placeholders: [docs/template-variables.md](docs/template-variables.md).
