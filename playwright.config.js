// @ts-check
import { defineConfig, devices } from '@playwright/test';

/** Set PLD_E2E_SQL=1 to run against `npm run dev` (API + Vite) on :5173. */
const sqlE2e = process.env.PLD_E2E_SQL === '1';
/** Set PLD_E2E_FIREBASE=1 to use Hosting emulator on :5000 (legacy). Default: Vite only on :5173 (no Firebase). */
const firebaseE2e = process.env.PLD_E2E_FIREBASE === '1';

/** Dedicated port so `npm run dev` on 5173 does not block Playwright's own Vite server. */
const viteE2ePort = Number(process.env.PLD_E2E_VITE_PORT || 5199);
const viteUrl = `http://127.0.0.1:${viteE2ePort}`;
const firebaseUrl = 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: sqlE2e ? 'http://127.0.0.1:5173' : !firebaseE2e ? viteUrl : firebaseUrl,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.CI
    ? undefined
    : sqlE2e
      ? {
          command: 'npm run dev',
          url: viteUrl,
          reuseExistingServer: true,
          timeout: 180_000,
        }
      : firebaseE2e
        ? {
            command:
              'npx firebase emulators:start --only hosting,firestore,auth,storage',
            url: firebaseUrl,
            reuseExistingServer: true,
            timeout: 180_000,
          }
        : {
            /** --host 127.0.0.1 so Playwright's URL probe matches (Windows localhost/IPv4). */
            command: `npx vite --port ${viteE2ePort} --strictPort --host 127.0.0.1`,
            url: viteUrl,
            reuseExistingServer: true,
            timeout: 180_000,
          },
});
