import { expect, test } from '@playwright/test';
import { field, lastToast, loadDemoData, openApp, visibleText } from './helpers';

test('sin Pro: Gastos invita a Garage Pro y al comprarlo se desbloquea', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page, '/tabs/stats');
  await expect(visibleText(page, 'Tus gastos, de un vistazo')).toBeVisible();

  await visibleText(page, 'Ver Garage Pro').click();
  await expect(page).toHaveURL(/\/pro\?from=stats/);
  await expect(visibleText(page, 'Las estadísticas de gasto son de Garage Pro.')).toBeVisible();
  // En desarrollo no hay tienda: el botón activa Pro directamente.
  await page.getByRole('button', { name: /Desbloquear por/ }).filter({ visible: true }).click();
  expect(await lastToast(page)).toContain('Garage Pro desbloqueado');

  await openApp(page, '/tabs/stats');
  await expect(visibleText(page, /Gastado en \d{4}/)).toBeVisible();
  await expect(visibleText(page, 'Tus gastos, de un vistazo')).toHaveCount(0);
});

test('sin Pro: los temas extra tienen candado y llevan a Garage Pro', async ({ page }) => {
  await openApp(page, '/tabs/settings');
  await page.locator('.palette').filter({ hasText: 'Neón' }).click();
  await expect(page).toHaveURL(/\/pro\?from=themes/);
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'taller');
});

test('sin Pro: hasta 2 vehículos propios (los de ejemplo no cuentan)', async ({ page }) => {
  await loadDemoData(page);
  for (const name of ['Moto 1', 'Moto 2']) {
    await openApp(page, '/vehicles/new');
    await field(page, 'Nombre').fill(name);
    await visibleText(page, 'Añadir al garage').click();
    await expect(page).toHaveURL(/\/vehicles\/[0-9a-f-]+$/);
  }
  await openApp(page, '/tabs/garage');
  await page.getByRole('link', { name: 'Añadir vehículo' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/pro\?from=vehicles/);
  await expect(visibleText(page, 'La versión gratuita llega hasta 2 vehículos')).toBeVisible();
});
