# Firebase emulators and testing (PLD_PM)

## Prerequisites

- Node.js 20+ recommended
- After clone: `npm install`
- First time: `npx firebase login` (needed for some CLI features; **Hosting emulator alone** often works with the `demo-pld-pm` placeholder in `.firebaserc`)

## Run the app locally (Hosting emulator)

```bash
npm run emulators:hosting
```

Open **http://127.0.0.1:5000** — same static tree as production build, with SPA fallback to `index.html`.

## Full emulator set (Hosting + Auth UI + Emulator UI)

```bash
npm run emulators
```

- **Hosting:** http://127.0.0.1:5000  
- **Auth emulator:** port `9099` (wire Firebase Auth SDK with `connectAuthEmulator` when you add auth)  
- **Emulator UI:** http://127.0.0.1:4000  

Add Firestore / Functions / Realtime Database to `firebase.json` → `emulators` when the backend uses them.

## End-to-end tests (Playwright)

Playwright starts the **Hosting emulator** automatically (see `playwright.config.js`).

```bash
npm run test:e2e
```

- UI mode: `npm run test:e2e:ui`
- Headed browser: `npm run test:e2e:headed`

In CI, set `CI=1` so the config uses a single worker and does not reuse a stray local server.

## Deploy vs local

`.firebaserc` uses `demo-pld-pm` for local-only work. Before **`firebase deploy`**, set `default` to your real Firebase project ID (or use `firebase use <projectId>`).

## Production URL

Target: **https://pm.paragonlivedesign.com** (separate Hosting site + custom domain — see project plan).
