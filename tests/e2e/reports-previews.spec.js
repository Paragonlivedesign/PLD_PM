import { test, expect } from '@playwright/test';

test.describe('Reports and previews', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://127.0.0.1:3000/api/**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          meta: null,
          errors: [{ code: 'E2E_STUB', message: 'API stubbed for reports-previews e2e' }],
        }),
      });
    });
    await page.goto('/');
    await expect(page).toHaveTitle(/PLD_PM|PM/i);
    // init.js may not reach renderPage('dashboard') if SQL/Firebase boot fails; force shell render for e2e.
    await page.waitForFunction(() => typeof window.renderPage === 'function', { timeout: 60_000 });
    await page.evaluate(() => {
      renderPage('dashboard');
      // When PLD_PM_DATA.init() fails, init.js returns before initModal(); wire modal close for e2e.
      if (typeof initModal === 'function') initModal();
    });
    await expect(page.getByRole('heading', { name: 'Operations Dashboard' })).toBeVisible({
      timeout: 30_000,
    });
    await page.evaluate(() => {
      if (typeof EVENTS === 'undefined') return;
      const hasClosed = EVENTS.some((e) => e.phase === 'closed');
      if (!hasClosed) {
        if (!CLIENTS.length) CLIENTS.push({ id: 'c-pld-e2e', name: 'E2E Client' });
        if (!VENUES.length) VENUES.push({ id: 'v-pld-e2e', name: 'E2E Venue', city: 'LA' });
        EVENTS.push({
          id: 'e-pld-e2e-closed',
          name: 'E2E Closed Event',
          client: CLIENTS[0].id,
          venue: VENUES[0].id,
          phase: 'closed',
          startDate: '2026-01-01',
          endDate: '2026-01-02',
          budget: 100000,
          spent: 88000,
          crew: [],
          priority: 'medium',
        });
      }
      if (typeof DOCUMENTS !== 'undefined' && !DOCUMENTS.some((d) => d.id === 'doc-pld-e2e-gen')) {
        DOCUMENTS.push({
          id: 'doc-pld-e2e-gen',
          name: 'E2E Generated Doc',
          event: EVENTS[0].id,
          type: 'crew_pack',
          format: 'pdf',
          size: '1 MB',
          updated: '2026-03-01',
          version: 1,
          source: 'generated',
        });
      }
    });
  });

  test('Financial Overview: cost breakdown hydrates or shows API message', async ({ page }) => {
    await page.locator('[data-page="financial"]').click();
    await expect(page.locator('.page-title')).toHaveText('Financial');
    const box = page.locator('#pldFinCostBreakdown');
    await expect(box).toBeVisible();
    await expect(box).toContainText(
      /Loading|unavailable|No cost rows|Labor|Travel|Equipment|Vendor|category|%/i,
      { timeout: 15_000 },
    );
  });

  test('Financial By Category: mount shows API-driven or empty state', async ({ page }) => {
    await page.locator('[data-page="financial"]').click();
    await page.getByRole('button', { name: 'By Category' }).click();
    const mount = page.locator('#pldFinByCategoryMount');
    await expect(mount).toBeVisible();
    await expect(mount).toContainText(/Loading|Could not load|No categories|total|Description/i, {
      timeout: 15_000,
    });
  });

  test('Financial Reports tab: Preview opens placeholder modal; Export shows toast', async ({
    page,
  }) => {
    await page.locator('[data-page="financial"]').click();
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByText('P&L Summary')).toBeVisible();
    await page.getByRole('button', { name: 'Preview' }).first().click();
    await expect(page.locator('#modalTitle')).toHaveText('P&L Summary');
    await expect(page.locator('#modalBody')).toContainText('Report preview would show here');
    await page.locator('#modalClose').click();
    await page
      .locator('.card')
      .filter({ hasText: 'P&L Summary' })
      .getByRole('button', { name: 'Export', exact: true })
      .click();
    await expect(page.locator('#toastContainer .toast').first()).toContainText(/Exporting/i, {
      timeout: 8000,
    });
  });

  test('Financial Settlements: View Report opens settlement modal', async ({ page }) => {
    await page.locator('[data-page="financial"]').click();
    await page.getByRole('button', { name: 'Settlements' }).click();
    const viewReport = page.getByRole('button', { name: 'View Report' }).first();
    await expect(viewReport).toBeVisible();
    await viewReport.click();
    await expect(page.locator('#modalTitle')).toContainText('Settlement Report');
    await expect(page.locator('#modalBody')).toContainText(/Budget|Final Cost|Category/i);
    await page.locator('#modalClose').click();
  });

  test('Documents: template Preview opens crew pack mockup', async ({ page }) => {
    await page.locator('[data-page="documents"]').click();
    await expect(page.locator('.page-title')).toHaveText('Documents');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    const prev = page.getByRole('button', { name: 'Preview' }).first();
    await prev.click();
    await expect(page.locator('#modalBody')).toContainText(/CREW PACK|Crew Pack/i, { timeout: 5000 });
    await page.locator('#modalClose').click();
  });

  test('Documents: Generated Preview opens modal (placeholder without API)', async ({ page }) => {
    await page.locator('[data-page="documents"]').click();
    await page.getByRole('button', { name: 'Generated' }).click();
    await expect(page.locator('text=E2E Generated Doc').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Preview' }).first().click();
    await expect(page.locator('#modalTitle')).toHaveText('Document Preview');
    await expect(page.locator('#modalBody')).toContainText(/Document preview would render here|Open.*download/i);
    await page.locator('#modalClose').click();
  });
});
