import { expect, test } from '@playwright/test';
import { alertButton, field, lastToast, loadDemoData, openApp, visibleText } from './helpers';

test('repostaje: se apunta desde el registro rápido, se corrige y se borra', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page, '/log');

  // Del registro de mantenimiento al de repostaje sin perder el vehículo.
  await page.locator('ion-segment-button').filter({ hasText: 'Repostaje', visible: true }).click();
  await expect(page).toHaveURL(/\/fuel\?vehicle=/);

  await field(page, 'Km').fill('23600');
  await field(page, 'Litros').fill('12,5');
  await field(page, 'Importe').fill('22,50');
  await field(page, 'Notas').fill('Gasolinera de prueba');
  await expect(visibleText(page, '1,800 €/L')).toBeVisible();
  await visibleText(page, 'Guardar repostaje').click();
  expect(await lastToast(page)).toContain('Repostaje guardado: 12,5 L');

  // Aparece en la línea de tiempo de la ficha, mezclado con los partes de trabajo.
  await openApp(page);
  await page.locator('.vehicle-card').filter({ visible: true }).first().click();
  // Los datos de ejemplo ya traen repostajes: la nota identifica el nuestro.
  const row = page.locator('.timeline-body').filter({ hasText: 'Gasolinera de prueba', visible: true });
  await expect(row).toContainText('12,5 L');
  await expect(row).toContainText('23.600');

  await row.click();
  await field(page, 'Litros').fill('13');
  await visibleText(page, 'Guardar cambios').click();
  await expect(page.locator('.timeline-body').filter({ hasText: 'Gasolinera de prueba', visible: true })).toContainText('13 L');

  await page.locator('.timeline-body').filter({ hasText: 'Gasolinera de prueba', visible: true }).click();
  await visibleText(page, 'Borrar repostaje').click();
  await alertButton(page, 'Borrar').click();
  await expect(page.locator('.timeline-body').filter({ hasText: 'Gasolinera de prueba', visible: true })).toHaveCount(0);
});

test('repostaje: los litros son obligatorios', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page, '/fuel');
  await visibleText(page, 'Guardar repostaje').click();
  await expect(page.locator('.g-error').filter({ visible: true })).not.toHaveCount(0);
});
