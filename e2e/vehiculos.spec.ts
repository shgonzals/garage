import { expect, test } from '@playwright/test';
import { addDays, format } from 'date-fns';
import { alertButton, field, lastToast, loadDemoData, openApp, visibleText } from './helpers';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

test('alta de vehículo con seguro: aparece en el garage y su seguro en urgencias', async ({ page }) => {
  await openApp(page);
  await visibleText(page, 'Añadir vehículo').click();

  await field(page, 'Nombre').fill('Mi Yamaha');
  await field(page, 'Marca').fill('Yamaha');
  await field(page, 'Km actuales').fill('12000');
  await field(page, 'Seguro: vence el').fill(iso(addDays(new Date(), 20)));
  await visibleText(page, 'Añadir al garage').click();

  // Ficha: el seguro vence en 20 días → "pronto".
  await expect(page.locator('.urgency').filter({ hasText: 'Seguro', visible: true })).toContainText('En 20 días');
  await expect(page.locator('.urgency').filter({ hasText: 'Seguro', visible: true })).toContainText('Vence el');

  await openApp(page);
  await expect(page.locator('.vehicle-card').filter({ visible: true })).toContainText(['MI YAMAHA'], { ignoreCase: true });
});

test('registro rápido y corrección de un registro', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page, '/log');
  await field(page, 'Km').fill('23500');
  await page.locator('.task').filter({ hasText: 'Bujías', visible: true }).click();
  await visibleText(page, 'Guardar registro').click();
  expect(await lastToast(page)).toContain('Registro guardado');

  // Editar desde el historial de la ficha.
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'CBR600RR', visible: true }).click();
  const row = page.locator('.timeline-body').filter({ hasText: 'Bujías', visible: true });
  await expect(row).toContainText('23.500');
  await row.click();
  await field(page, 'Km').fill('23400');
  await visibleText(page, 'Guardar cambios').click();
  await expect(page.locator('.timeline-body').filter({ hasText: 'Bujías', visible: true })).toContainText('23.400');
});

test('los datos de ejemplo no se duplican y se pueden quitar', async ({ page }) => {
  await loadDemoData(page);
  await expect(visibleText(page, 'Cargar datos de ejemplo')).toHaveCount(0);

  await visibleText(page, 'Quitar datos de ejemplo').click();
  await alertButton(page, 'Quitar').click();
  await expect(visibleText(page, 'Cargar datos de ejemplo')).toBeVisible();

  await openApp(page);
  await expect(visibleText(page, 'Tu garage está vacío')).toBeVisible();
});

test('Google Calendar: crea el evento con la fecha del vencimiento', async ({ page, context }) => {
  // No salimos a internet: se intercepta la petición y se comprueba el enlace que abriría la app.
  let opened = '';
  await context.route('https://calendar.google.com/**', (route) => {
    opened = route.request().url();
    return route.fulfill({ body: 'ok' });
  });
  await loadDemoData(page);
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'CBR600RR', visible: true }).click();

  const card = page.locator('.urgency').filter({ hasText: 'Seguro', visible: true });
  await Promise.all([context.waitForEvent('page'), card.getByRole('button', { name: /Google Calendar/ }).click()]);
  await expect.poll(() => opened).not.toBe('');

  const url = new URL(opened);
  expect(url.searchParams.get('text')).toBe('CBR600RR · Seguro');
  const day = format(addDays(new Date(), 20), 'yyyyMMdd');
  expect(url.searchParams.get('dates')).toMatch(new RegExp(`^${day}/`));
});

test('posponer un aviso vencido y quitar el aplazamiento', async ({ page }) => {
  await loadDemoData(page);
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'CBR600RR', visible: true }).click();
  const lights = page.locator('.lights').filter({ visible: true });
  await expect(lights).toContainText('3 vencidos');

  const card = page.locator('.urgency').filter({ hasText: 'Tensión de cadena', visible: true });
  await card.getByRole('button', { name: /Posponer/ }).click();
  await page.locator('ion-action-sheet button', { hasText: '1 semana' }).click();

  await expect(card).toContainText('Pospuesto hasta el');
  await expect(lights).toContainText('2 vencidos');

  // En Recordatorios aparece en su propia sección.
  await openApp(page, '/tabs/reminders');
  await expect(visibleText(page, /Pospuestos · 1/)).toBeVisible();

  // Quitar el aplazamiento: vuelve a contar como vencido.
  await openApp(page);
  await page.locator('.vehicle-card').filter({ hasText: 'CBR600RR', visible: true }).click();
  await page
    .locator('.urgency')
    .filter({ hasText: 'Tensión de cadena', visible: true })
    .getByRole('button', { name: /Quitar aplazamiento/ })
    .click();
  await page.locator('ion-action-sheet button', { hasText: 'Quitar aplazamiento' }).click();
  await expect(page.locator('.lights').filter({ visible: true })).toContainText('3 vencidos');
});
