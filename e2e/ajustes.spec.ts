import { expect, test } from '@playwright/test';
import { alertButton, field, lastToast, loadDemoData, openApp, visibleText } from './helpers';

test('tareas personalizadas: se crean en el plan y se pueden registrar', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'COROLLA', visible: true }).click();
  await visibleText(page, 'Plan').click();

  const form = page.locator('form.new').filter({ visible: true });
  await field(page, 'Nombre').fill('Escobillas');
  await form.locator('.emoji').nth(3).click();
  await form.locator('ion-input').filter({ hasText: 'Cada (años)' }).locator('input').fill('1');
  await visibleText(page, 'Añadir al plan').click();
  expect(await lastToast(page)).toContain('Escobillas');
  await expect(page.locator('.rename').filter({ hasText: 'Escobillas', visible: true })).toBeVisible();

  await openApp(page, '/log');
  await page.locator('.pick').filter({ hasText: 'Corolla' }).click();
  await expect(page.locator('.task').filter({ hasText: 'Escobillas', visible: true })).toBeVisible();
});

test('exportar e importar una copia en un dispositivo nuevo', async ({ page, browser }) => {
  await loadDemoData(page);
  const [download] = await Promise.all([page.waitForEvent('download'), visibleText(page, 'Exportar copia').click()]);
  expect(download.suggestedFilename()).toMatch(/^garage-copia-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();

  // Otro contexto = otro navegador con la base de datos vacía.
  const other = await (await browser.newContext()).newPage();
  await openApp(other, '/tabs/settings');
  await other.locator('input[type=file][accept*="json"]').setInputFiles(file);
  await alertButton(other, 'Importar').click();
  expect(await lastToast(other)).toMatch(/importada: 3 vehículos/);

  await openApp(other);
  await expect(other.locator('.vehicle-card').filter({ visible: true })).toHaveCount(3);
});

test('cambiar de tema y de modo', async ({ page }) => {
  await openApp(page, '/tabs/settings');
  await page.locator('.palette').filter({ hasText: 'Petróleo' }).click();
  await page.locator('ion-segment-button').filter({ hasText: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'petroleo');
  await expect(page.locator('html')).toHaveClass(/ion-palette-dark/);

  // Se recuerda al volver a abrir.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'petroleo');
});

test('escritorio: menú lateral con vehículos y contraíble @escritorio', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page);
  const menu = page.locator('ion-menu');
  await expect(menu.getByText('CBR600RR')).toBeVisible();
  await expect(page.locator('ion-tab-bar')).toBeHidden();

  await menu.getByRole('button', { name: 'Contraer menú' }).click();
  await expect(menu.getByText('CBR600RR')).toBeHidden();
  await menu.getByRole('button', { name: 'Expandir menú' }).click();

  await menu.getByText('Scrambler').click();
  await expect(visibleText(page, 'Ducati Scrambler Icon')).toBeVisible();
});
