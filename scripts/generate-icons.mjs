/**
 * Genera los PNG del logo a partir del mismo dibujo que resources/logo/garage-icon.svg:
 * iconos de Android 7 (mipmap-*), e icono de Play Store (resources/play-store-icon-512.png).
 * El icono adaptativo (Android 8+) y la pantalla de inicio son vectoriales: android/app/src/main/res/drawable.
 *
 * Uso: npm run icons   (usa el Chrome instalado en el sistema; no descarga navegadores)
 */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const RES = `${root}android/app/src/main/res`;
const OUT = `${root}resources`;
const G = `
  <path d="M73.9 37.3 A26 26 0 1 0 80 54" fill="none" stroke="#14171B" stroke-width="9" stroke-linecap="round"/>
  <line x1="56" y1="54" x2="79" y2="54" stroke="#14171B" stroke-width="6" stroke-linecap="round"/>
  <circle cx="54" cy="54" r="5.5" fill="#14171B"/>
  <circle cx="54" cy="54" r="2.2" fill="#F5C518"/>`;
// Recorte visible del icono adaptativo (18…90). Forma: cuadrado, cuadrado redondeado o círculo.
const svg = (shape, box = '18 18 72 72') => {
  const bg = shape === 'circle'
    ? '<circle cx="54" cy="54" r="36" fill="#F5C518"/>'
    : (() => {
        const [x, y, w, h] = box.split(' ').map(Number);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape === 'rounded' ? w * 0.19 : 0}" fill="#F5C518"/>`;
      })();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="100%" height="100%">${bg}${G}</svg>`;
};
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
async function render(size, shape, path, box) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(shape, box)}</body></html>`);
  await p.screenshot({ path, omitBackground: true });
}
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(DENSITIES)) {
  await render(size, 'rounded', `${RES}/mipmap-${d}/ic_launcher.png`);
  await render(size, 'circle', `${RES}/mipmap-${d}/ic_launcher_round.png`);
}
// Play Store: 512 × 512, cuadrado completo (Google aplica su propia máscara).
// Margen extra: la G (Ø 61) cabe en el círculo guía del 75 % que recomienda Google.
await render(512, 'square', `${OUT}/play-store-icon-512.png`, '12 12 84 84');
await b.close();
console.log('Iconos generados en android/app/src/main/res/mipmap-* y resources/');
