import { test, expect } from '@playwright/test';

/**
 * Canonical page ids from js/router.js renderPage switch (default → "Page not found").
 */
const ROUTE_IDS = [
  'dashboard',
  'tasks',
  'task',
  'events',
  'scheduling',
  'event',
  'personnel',
  'personnel-profile',
  'trucks',
  'travel',
  'financial',
  'documents',
  'clients',
  'client',
  'venues',
  'venue',
  'vendors',
  'vendor',
  'contacts',
  'contact',
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
        if (id === 'client' && typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) && CLIENTS[0]) {
          selectedClientId = CLIENTS[0].id;
          navigateTo('client');
          return;
        }
        if (id === 'vendor' && typeof VENDORS !== 'undefined' && Array.isArray(VENDORS) && VENDORS[0]) {
          selectedVendorId = VENDORS[0].id;
          navigateTo('vendor');
          return;
        }
        if (id === 'venue' && typeof VENUES !== 'undefined' && Array.isArray(VENUES) && VENUES[0]) {
          selectedVenueId = VENUES[0].id;
          navigateTo('venue');
          return;
        }
        if (id === 'contact') {
          selectedContactParentKind = 'client';
          selectedContactParentId =
            typeof CLIENTS !== 'undefined' && Array.isArray(CLIENTS) && CLIENTS[0]
              ? CLIENTS[0].id
              : '';
          selectedContactId = '';
          navigateTo('contact');
          return;
        }
        if (
          id === 'personnel-profile' &&
          typeof PERSONNEL !== 'undefined' &&
          Array.isArray(PERSONNEL) &&
          PERSONNEL[0]
        ) {
          selectedPersonnelId = PERSONNEL[0].id;
          navigateTo('personnel-profile');
          return;
        }
        if (id === 'task') {
          if (
            typeof window.__pldTasksCache !== 'undefined' &&
            Array.isArray(window.__pldTasksCache) &&
            window.__pldTasksCache[0]
          ) {
            selectedTaskId = window.__pldTasksCache[0].id;
          } else {
            selectedTaskId = null;
          }
          taskDetailTab = 'overview';
          navigateTo('task');
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
