/**
 * Capturas para la ficha de Google Play, en español e inglés:
 *   store/screenshots/<idioma>/01-garage.png … (1080 × 1920, móvil)
 *   store/screenshots/<idioma>/feature-graphic.png (1024 × 500, gráfico destacado)
 *
 * Arranca la app (Vite), carga los datos de ejemplo con Garage Pro activado y fotografía cada
 * pantalla con el Chrome instalado. Uso: npm run store:shots
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5181;
const BASE = `http://localhost:${PORT}`;

const TEXT = {
  es: {
    load: 'Cargar datos de ejemplo',
    confirm: 'Cargar',
    tagline: 'Apunta lo que le haces\na tu moto o tu coche',
    sub: 'y te avisa de lo siguiente que toca',
  },
  en: {
    load: 'Load sample data',
    confirm: 'Load',
    tagline: 'Log the work you do\non your bike or car',
    sub: 'and it reminds you when the next job is due',
  },
};

const server = spawn(`npx vite --port ${PORT} --strictPort`, { cwd: root, shell: true, stdio: 'ignore' });
const stop = () => {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // todavía arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Vite no arrancó');
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  await waitForServer();
  for (const lang of ['es', 'en']) {
    const out = `${root}store/screenshots/${lang}`;
    mkdirSync(out, { recursive: true });
    // 360 × 640 a 3x = 1080 × 1920 (9:16, lo que pide Play para móvil).
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 3,
      locale: lang === 'es' ? 'es-ES' : 'en-GB',
      colorScheme: 'light',
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(() => localStorage.setItem('garage-pro', '1'));
    const page = await context.newPage();
    // La primera carga de Vite (optimizar dependencias) puede tardar.
    page.setDefaultTimeout(90_000);
    const settle = () => page.waitForTimeout(1200);

    await page.goto(`${BASE}/tabs/settings`);
    await settle();
    await page.getByText(TEXT[lang].load).first().click();
    await page.locator('ion-alert button', { hasText: TEXT[lang].confirm }).click();
    await page.waitForTimeout(2500);

    const shots = [
      ['01-garage', '/tabs/garage'],
      ['03-reminders', '/tabs/reminders'],
      ['04-stats', '/tabs/stats'],
      ['05-quick-log', '/log'],
    ];
    for (const [name, path] of shots) {
      await page.goto(`${BASE}${path}`);
      await settle();
      await page.screenshot({ path: `${out}/${name}.png` });
    }

    // Ficha del primer vehículo y su plan de mantenimiento.
    await page.goto(`${BASE}/tabs/garage`);
    await settle();
    await page.locator('.vehicle-card').first().click();
    await settle();
    await page.screenshot({ path: `${out}/02-vehicle.png` });
    await page.goto(`${page.url()}/plan`);
    await settle();
    await page.screenshot({ path: `${out}/06-plan.png` });
    await context.close();

    // Gráfico destacado: 1024 × 500.
    const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    const icon = readFileSync(`${root}resources/play-store-icon-512.png`).toString('base64');
    const font = readFileSync(
      `${root}node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2`,
    ).toString('base64');
    await fg.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: 'Barlow Condensed'; font-weight: 700;
        src: url(data:font/woff2;base64,${font}) format('woff2'); }
      body { font-weight: 700; margin: 0; width: 1024px; height: 500px; overflow: hidden; background: #14171b; color: #f1f3f5;
        font-family: 'Barlow Condensed', 'Segoe UI', sans-serif; display: flex; align-items: center; }
      .stripe { position: absolute; left: 0; right: 0; bottom: 0; height: 14px;
        background: repeating-linear-gradient(135deg, #f5c518 0 24px, #14171b 24px 48px); }
      img { width: 220px; height: 220px; border-radius: 48px; margin: 0 56px 0 80px; }
      h1 { margin: 0; font-size: 92px; letter-spacing: 0.04em; text-transform: uppercase; color: #f5c518; }
      p { margin: 8px 0 0; font-size: 44px; max-width: 640px; line-height: 1.1; white-space: pre-line; }
      .sub { font-size: 28px; color: #9aa1a9; margin-top: 18px; letter-spacing: 0.02em; }
    </style></head><body>
      <img src="data:image/png;base64,${icon}" alt="" />
      <div><h1>Garage</h1><p>${TEXT[lang].tagline}</p><p class="sub">${TEXT[lang].sub}</p></div>
      <div class="stripe"></div>
    </body></html>`);
    await fg.evaluate(() => document.fonts.ready);
    await fg.screenshot({ path: `${out}/feature-graphic.png` });
    await fg.close();
    console.log(`✓ ${lang}: store/screenshots/${lang}/`);
  }
} finally {
  await browser.close();
  stop();
}
