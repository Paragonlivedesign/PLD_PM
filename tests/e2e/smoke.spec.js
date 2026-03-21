import { test, expect } from '@playwright/test';

test.describe('PLD_PM smoke', () => {
  test('loads shell (Vite default; set PLD_E2E_FIREBASE=1 for Hosting emulator)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PLD_PM|PM/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
