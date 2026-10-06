import { expect, test } from '@playwright/test';
import { openApp, visibleText } from './helpers';

test.describe('móvil en inglés', () => {
  test.use({ locale: 'en-GB' });

  test('la app sale en inglés y se puede cambiar a español en Ajustes', async ({ page }) => {
    await openApp(page);
    await expect(visibleText(page, 'Your garage is empty')).toBeVisible();
    await expect(page.locator('ion-tab-button').filter({ hasText: 'Spending' })).toBeVisible();

    await openApp(page, '/tabs/settings');
    await page.locator('ion-segment-button').filter({ hasText: 'Español', visible: true }).click();
    await expect(visibleText(page, 'Idioma')).toBeVisible();
    await expect(page.locator('ion-tab-button').filter({ hasText: 'Gastos' })).toBeVisible();

    // La elección se recuerda al volver a abrir la app.
    await openApp(page);
    await expect(visibleText(page, 'Tu garage está vacío')).toBeVisible();
  });
});
