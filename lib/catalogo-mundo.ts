/**
 * Mundo vuelve a ser la categorización pública (familia pasa a dato
 * interno — ver plan Sprint 5.5). A diferencia de familia, `mundo` ya ES
 * el slug de la URL (columna `catalogo_productos.mundo`, ver migración
 * catalogo_09_mundos) — no hace falta slugify ni reverse-lookup como
 * necesitaba familia (nombre bonito vs. slug). El nombre de display de
 * cada mundo vive en `catalogo_mundos` (tabla aparte, ver
 * lib/catalogo-server.ts).
 */

import type { ProductoPublico } from './catalogo-familia';

// Sólo hace falta al CREAR un mundo nuevo desde el panel admin (Task
// 5.5.6) — los 7 de siempre ya tienen su slug fijo en catalogo_mundos
// (no derivable del nombre, ver plan Sprint 5.5). Mismo criterio de
// siempre: NFD, saca diacríticos, todo lo que no sea a-z0-9 se vuelve '-'.
export function slugifyMundo(nombre: string): string {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Slugs de mundo distintos, presentes en productos publicados, orden
// alfabético — arma la navegación dinámica (nav/footer, mismo criterio
// que ya tenía familiasDisponibles).
export function mundosDisponibles(productos: ProductoPublico[]): string[] {
  const set = new Set<string>();
  productos.forEach((p) => {
    if (p.mundo) set.add(p.mundo);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

export function productosDeMundo(productos: ProductoPublico[], mundoSlug: string): ProductoPublico[] {
  return productos.filter((p) => p.mundo === mundoSlug);
}
