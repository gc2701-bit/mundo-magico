// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8000',
  },
  webServer: {
    // El sitio servible sigue siendo el output de Eleventy (_site/), no la
    // raíz del repo — la raíz tiene los *.html fuente con front
    // matter/Nunjucks, no HTML válido para el browser. Desde la migración a
    // Next.js (ver docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md),
    // `npm run build` pasó a ser `next build` — el sitio Eleventy viejo,
    // que este e2e sigue probando hasta que el nuevo lo reemplace, se
    // genera ahora con `npm run build:eleventy`.
    command: 'npm run build:eleventy && cd _site && node ../.claude/static-server.js',
    url: 'http://localhost:8000/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
