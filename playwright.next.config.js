// @ts-check
// Config separada para el sitio Next.js nuevo — el playwright.config.js
// de siempre sigue probando el sitio Eleventy viejo (puerto 8000) hasta
// que este lo reemplace del todo (Sprint 7). No se mezclan los dos
// webServer en una sola config para no confundir contra qué build corre
// cada suite. Ver docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e-next',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
