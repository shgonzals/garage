import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de interfaz: la app real (Vite) manejada como un usuario, con su base de datos web
 * (jeep-sqlite) vacía en cada test. Usa el Chrome instalado: no hace falta descargar navegadores.
 *
 *   npm run test:e2e          todos
 *   npm run test:e2e -- --ui  modo visual para depurar
 */
const PORT = 5180;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'móvil', use: { ...devices['Pixel 7'], channel: 'chrome' }, grepInvert: /@escritorio/ },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } }, grep: /@escritorio/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
