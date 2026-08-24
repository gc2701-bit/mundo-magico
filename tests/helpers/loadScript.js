/* Los archivos de assets/*.js son IIFEs "de toda la vida" (sin import/export,
 * sin bundler) que se enganchan a `window.MM*`. No hay forma de `import`-earlos
 * en Vitest sin un paso de build que este repo a propósito no tiene (ver
 * mundo-magico/CLAUDE.md — sitio vanilla, sin bundler).
 *
 * Este helper carga el archivo tal cual se sirve al navegador: lee el texto y
 * lo ejecuta contra el `window`/`document` de jsdom con `new Function(...)`,
 * exactamente como haría un <script src="..."> en la página real. Así el
 * archivo bajo test es el archivo real que corre en producción, no una copia
 * ni un mock del módulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// assets/ (y Logo/, productos/, "Header categories/") viven físicamente
// bajo public/ desde el Sprint 2 de la migración a Next.js (ver
// docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md) —
// Eleventy y Next los sirven en la misma URL de siempre, así que los
// tests siguen pidiendo 'assets/x.js' tal cual, sin tocar cada call site;
// solo este helper sabe dónde vive de verdad el archivo en disco.
function resolverRuta(relPath) {
  if (relPath === 'assets' || relPath.startsWith('assets/')) {
    return path.join(ROOT, 'public', relPath);
  }
  return path.join(ROOT, relPath);
}

export function loadScript(relPath) {
  const full = resolverRuta(relPath);
  const code = fs.readFileSync(full, 'utf8');
  // Mismo scope global que un <script> clásico: `window`, `document`,
  // `sessionStorage`, `localStorage`, etc. ya están en el global de jsdom
  // (environment: 'jsdom' en vitest.config.js), así que alcanza con
  // ejecutar el código - no hace falta pasarle nada explícito.
  const fn = new Function(code);
  fn();
}

export function readAsset(relPath) {
  return fs.readFileSync(resolverRuta(relPath), 'utf8');
}

export function readHtml(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

export const ROOT_DIR = ROOT;
