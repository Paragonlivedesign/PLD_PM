import { test, expect } from '@playwright/test';

/**
 * Canonical page ids from js/router.js renderPage switch (default → "Page not found").
 */
const ROUTE_IDS = [
  'dashboard',
  'events',
  'scheduling',
  'event',
  'personnel',
  'trucks',
  'travel',
  'financial',
  'documents',
  'clients',
  'venues',
  'vendors',
  'settings',
  'search',
  'platform-admin',
  'login',
  'forgot-password',
  'reset-password',
  'invite-accept',
  'account',
  'invite-user',
];

test.describe('PLD_PM route smoke', () => {
  for (const routeId of ROUTE_IDS) {
    test(`page "${routeId}" renders without router 404`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(
        () =>
          typeof window.navigateTo === 'function' &&
          document.getElementById('pageContent') != null,
        { timeout: 60_000 },
      );

      await page.evaluate((id) => {
        if (
          id === 'event' &&
          typeof EVENTS !== 'undefined' &&
          Array.isArray(EVENTS) &&
          EVENTS[0] &&
          typeof navigateToEvent === 'function'
        ) {
          navigateToEvent(EVENTS[0].id);
          return;
        }
        navigateTo(id);
      }, routeId);

      const content = page.locator('#pageContent');
      await expect(content).not.toBeEmpty({ timeout: 15_000 });

      const html = await content.innerHTML();
      expect(html).not.toContain('<h3>Page not found</h3>');
      // Note: Do not assert zero pageerrors — many routes call pldApiFetch on load; without a
      // backend the browser may report "Failed to fetch". Use PLD_E2E_SQL=1 + API for full-stack smoke.
    });
  }
});
