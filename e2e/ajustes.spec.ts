import { expect, test } from '@playwright/test';
import { alertButton, field, lastToast, loadDemoData, openApp, visibleText } from './helpers';

test('tareas personalizadas: se crean en el plan y se pueden registrar', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'COROLLA', visible: true }).click();
  await visibleText(page, 'Plan').click();
  await page.locator('.catalog-toggle').filter({ visible: true }).click();

  const form = page.locator('form.new').filter({ visible: true });
  await field(page, 'Nombre').fill('Escobillas');
  await form.locator('.emoji').nth(3).click();
  await form.locator('ion-input').filter({ hasText: 'Cada (años)' }).locator('input').fill('1');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).filter({ visible: true }).click();
  expect(await lastToast(page)).toContain('Escobillas');
  await expect(page.locator('.task-summary').filter({ hasText: 'Escobillas', visible: true })).toContainText('Cada 1 año');

  await openApp(page, '/log');
  await page.locator('.pick').filter({ hasText: 'Corolla' }).click();
  await expect(page.locator('.task').filter({ hasText: 'Escobillas', visible: true })).toBeVisible();
});

test('plan: las tareas inactivas están en el catálogo y se activan con su intervalo orientativo', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'CBR600RR', visible: true }).click();
  await visibleText(page, 'Plan').click();

  // Arriba solo lo activo; el aceite de horquilla está en el catálogo.
  await expect(page.locator('.task[data-task="fork_oil"]')).toHaveCount(0);
  await page.locator('.catalog-toggle').filter({ visible: true }).click();
  await page.locator('.chip').filter({ hasText: 'Aceite de horquilla', visible: true }).click();

  const card = page.locator('.task[data-task="fork_oil"]').filter({ visible: true });
  await expect(card.locator('ion-input').filter({ hasText: 'Cada (km)' }).locator('input')).toHaveValue('20000');
  await expect(card).toContainText('Valor orientativo');
  await page.locator('ion-header ion-button').filter({ hasText: 'Guardar', visible: true }).click();
  await expect(page).not.toHaveURL(/\/plan$/);

  // Ya forma parte del plan: aparece arriba en el registro rápido.
  await openApp(page, '/log');
  await expect(page.locator('.tasks').first().locator('.task').filter({ hasText: 'Aceite de horquilla' })).toBeVisible();
});

test('registro rápido: el resto del catálogo está en "Más tareas", con buscador', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page, '/log');
  const primary = page.locator('.tasks').first();
  await expect(primary.locator('.task').filter({ hasText: 'Rodamientos de dirección' })).toHaveCount(0);

  await page.locator('.more-toggle').click();
  await page.locator('ion-input.search input').fill('direccion'); // sin tilde
  const more = page.locator('.more');
  await expect(more.locator('.task')).toHaveCount(1);
  await more.locator('.task').filter({ hasText: 'Rodamientos de dirección' }).click();

  // Marcada, sube a la lista principal.
  await expect(primary.locator('.task.active').filter({ hasText: 'Rodamientos de dirección' })).toBeVisible();
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
