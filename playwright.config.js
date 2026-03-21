// @ts-check
import { defineConfig, devices } from '@playwright/test';

/** Set PLD_E2E_SQL=1 to run against Vite + API (Postgres) on :5173 — no Firebase emulators. */
const sqlE2e = process.env.PLD_E2E_SQL === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: sqlE2e ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.CI
    ? undefined
    : sqlE2e
      ? {
          command: 'npm run dev',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: true,
          timeout: 180_000,
        }
      : {
          command:
            'npx firebase emulators:start --only hosting,firestore,auth,storage',
          url: 'http://127.0.0.1:5000',
          reuseExistingServer: true,
          timeout: 180_000,
        },
});
