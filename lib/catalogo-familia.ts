/**
 * Familias: reemplazan mundos/subcategorías (ver
 * docs/superpowers/specs/2026-08-20-nextjs-migracion-familias-design.md,
 * sección 4). Funciones puras — sin I/O, sin Next.js — para poder
 * testearlas sin mockear fetch/servidor.
 */

export type Foto = { src: string; cap: string; codigo?: string };
export type Talle = { nombre: string; codigo: string };

export type ProductoPublico = {
  id: string;
  pagina: string;
  subcategoriaId: string | null;
  titulo: string;
  slug: string;
  codigo: string | null;
  specs: string[] | null;
  descripcion: string | null;
  tags: string[] | null;
  talles: Talle[] | null;
  fotos: Foto[];
  orden: number;
  familia: string | null;
};

// Mismo criterio de slug que .claude/migrar-tarjetas-lib.js (y
// assets/precios.js): NFD, saca diacríticos, todo lo que no sea a-z0-9 se
// vuelve '-'. Se duplica a propósito acá — es una herramienta de migración
// de una sola vez vs. el código que sirve el sitio, no tiene sentido
// compartir el módulo entre las dos cosas.
export function slugifyFamilia(nombre: string): string {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Lista de familias distintas presentes en productos publicados, orden
// alfabético — es lo que arma la navegación dinámica (nav/footer, Task 2.4).
// Productos sin familia (huérfanos, ver spec sección 4) no aparecen acá.
export function familiasDisponibles(productos: ProductoPublico[]): string[] {
  const set = new Set<string>();
  productos.forEach((p) => {
    if (p.familia) set.add(p.familia);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

export function productosDeFamilia(productos: ProductoPublico[], familia: string): ProductoPublico[] {
  return productos.filter((p) => p.familia === familia);
}

// El slug de la URL (/[familia]/page.tsx) no es reversible a la familia
// original (mayúsculas, tildes) sin buscarla — se resuelve comparando el
// slug de cada familia distinta contra el de la URL.
export function familiaDesdeSlug(productos: ProductoPublico[], slug: string): string | null {
  const familias = familiasDisponibles(productos);
  return familias.find((f) => slugifyFamilia(f) === slug) || null;
}
