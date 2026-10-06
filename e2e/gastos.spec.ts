import { expect, test } from '@playwright/test';
import { loadDemoData, openApp, unlockPro, visibleText } from './helpers';

test('gastos: total del año, gráfico y cifras por vehículo', async ({ page }) => {
  await unlockPro(page);
  await loadDemoData(page);
  await openApp(page, '/tabs/stats');

  await expect(visibleText(page, /Gastado en \d{4}/)).toBeVisible();
  await expect(page.locator('.hero-value').filter({ visible: true })).toContainText('€');
  await expect(page.locator('.viz .legend').filter({ visible: true })).toContainText('Combustible');

  // Tabla por vehículo → al tocar una fila se filtra por ese vehículo.
  await page.locator('.table tbody tr').filter({ hasText: 'Corolla', visible: true }).click();
  await expect(visibleText(page, /Corolla en \d{4}/)).toBeVisible();
  await expect(page.locator('.kpi').filter({ hasText: 'Consumo medio', visible: true })).toContainText('L/100 km');

  // Hover/teclado sobre un mes: tooltip con el desglose.
  await page.locator('.viz .hit').filter({ visible: true }).nth(8).focus();
  await expect(page.locator('.viz .tip').filter({ visible: true })).toContainText('Total');
});
