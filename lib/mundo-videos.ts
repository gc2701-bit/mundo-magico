/**
 * Videos de header por mundo (Sprint 5, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * el sitio viejo ya tenía uno por categoría (`<header class="portal">`,
 * filmados con productos reales), portados a `public/Header categories/`
 * en un sprint anterior pero nunca conectados a ninguna página. Sólo 5 de
 * los 9 mundos tienen uno — Combos/Especiales nunca tuvieron, Halloween/
 * Navidad son nuevos. Filmar los que faltan es tarea de negocio, no de
 * este proyecto (ver la spec).
 *
 * Pendiente conocido: Reposteria-3.mp4 pesa ~6MB — comprimir con ffmpeg
 * antes de servirlo en producción de verdad (no se pudo hacer en este
 * entorno de desarrollo, no tiene ffmpeg instalado y no hay acceso para
 * instalarlo — ver el plan).
 */
export const MUNDO_VIDEOS: Record<string, string> = {
  'globos-fiesta': '/Header categories/Header-2-Cotillon.mp4',
  cumpleanos: '/Header categories/Cumpleaños-2.mp4',
  decoracion: '/Header categories/Deco-2.mp4',
  disfraces: '/Header categories/Disfraces - web.mp4',
  reposteria: '/Header categories/Reposteria-3.mp4',
};
