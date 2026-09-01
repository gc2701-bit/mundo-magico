/**
 * Slug genérico (NFD, sin diacríticos, todo lo que no sea a-z0-9 se vuelve
 * '-') — extraído del cuerpo que ya tenía slugifyMundo (lib/catalogo-mundo.ts)
 * para reusarlo donde haga falta convertir texto arbitrario (nombre de mundo,
 * código de POS, familia) en algo ASCII-safe para una key de Supabase
 * Storage o una URL, sin triplicar la misma lógica (ver
 * tasks/plan-activar-invalid-key.md).
 */
export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
