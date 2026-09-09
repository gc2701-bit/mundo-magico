import localFont from "next/font/local";

/**
 * Mismos archivos autoalojados que ya usa el sitio viejo
 * (public/assets/fonts/, portados en Sprint 2 de feat/nextjs-migration) —
 * no se agregan fuentes nuevas. Un solo loader con normal+italic en la
 * misma familia, igual que el @font-face de assets/v2.css: así el
 * navegador elige la itálica sola cuando se aplica `italic` sobre
 * `font-display`, sin necesitar una familia separada.
 *
 * No hay loader de Caveat a propósito — se reemplaza por Fraunces
 * itálica (combo de clases `font-display italic`) para las fichas de
 * detalle de producto. Ver docs/superpowers/specs/2026-08-24-frontend-cliente-rediseno-design.md.
 */
export const fraunces = localFont({
  src: [
    {
      path: "../public/assets/fonts/Fraunces-500.woff2",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "../public/assets/fonts/Fraunces-500-italic.woff2",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "optional",
});

export const nunitoSans = localFont({
  src: [
    {
      path: "../public/assets/fonts/NunitoSans-400.woff2",
      weight: "400 800",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "optional",
});

/**
 * Reemplaza a Fraunces como `--font-display` (Rediseño Home 2026-09-08,
 * Task 0 — decisión del usuario: seguir el spec de `Home.dc.html` de forma
 * literal, no aproximada). Caprasimo sólo tiene un peso (400, Regular) en
 * Google Fonts — a diferencia de Fraunces no hay variable de peso.
 * Autoalojada igual que el resto (ver comentario de arriba): el .woff2 se
 * bajó una sola vez desde el mismo archivo que sirve la CSS API de Google
 * Fonts (fonts.gstatic.com), no se linkea a fonts.googleapis.com en
 * runtime.
 */
export const caprasimo = localFont({
  src: "../public/assets/fonts/Caprasimo-Regular.woff2",
  variable: "--font-caprasimo",
  display: "optional",
});
