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
    // El sitio servible ahora es el output de Eleventy (_site/), no la raíz
    // del repo — la raíz tiene los *.html fuente con front matter/Nunjucks,
    // no HTML válido para el browser. `npm run build` corre antes de levantar
    // el server para no testear contra un _site/ desactualizado.
    command: 'npm run build && cd _site && node ../.claude/static-server.js',
    url: 'http://localhost:8000/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
