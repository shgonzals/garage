import { expect, type Locator, type Page } from '@playwright/test';

/*
 * Ionic deja en el DOM las páginas anteriores (ocultas) para animar el "atrás": los selectores
 * se quedan siempre con lo visible.
 */

/** El `<input>`/`<textarea>` real de un `ion-input`/`ion-textarea` visible con esa etiqueta. */
export function field(page: Page, label: string): Locator {
  return page
    .locator('ion-input, ion-textarea')
    .filter({ hasText: label, visible: true })
    .locator('input, textarea')
    .first();
}

/** Elemento visible con ese texto (botones, tarjetas, títulos…). */
export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true }).first();
}

/** Abre la app y espera a que la base de datos esté lista y la pantalla pintada. */
export async function openApp(page: Page, path = '/tabs/garage') {
  await page.goto(path);
  await expect(page.locator('ion-tab-bar, ion-split-pane').first()).toBeAttached();
}

/** Botón de un `ion-alert` abierto. */
export function alertButton(page: Page, text: string): Locator {
  return page.locator('ion-alert button', { hasText: text });
}

/** Garage Pro activado (como si ya se hubiera comprado): se aplica antes de cargar la app. */
export async function unlockPro(page: Page) {
  await page.addInitScript(() => localStorage.setItem('garage-pro', '1'));
}

export async function loadDemoData(page: Page) {
  await openApp(page, '/tabs/settings');
  await visibleText(page, 'Cargar datos de ejemplo').click();
  await alertButton(page, 'Cargar').click();
  await expect(visibleText(page, 'Quitar datos de ejemplo')).toBeVisible();
}

/** Mensaje del último `ion-toast` (el texto vive en su shadow DOM). */
export async function lastToast(page: Page): Promise<string> {
  const toast = page.locator('ion-toast').last();
  await expect(toast).toBeAttached();
  return toast.evaluate((t) => (t as HTMLElement & { message: string }).message);
}
