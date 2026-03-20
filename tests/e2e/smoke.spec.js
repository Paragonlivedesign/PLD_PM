import { test, expect } from '@playwright/test';

test.describe('PLD_PM smoke', () => {
  test('loads shell via Hosting emulator', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Production Manager/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
