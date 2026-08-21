import type { ProductoPublico } from './catalogo-familia';

/**
 * Funciones puras del panel admin de catálogo (Sprint 4). Con todo
 * unificado en catalogo_productos desde el Sprint 1, ya no hace falta la
 * rama origen:'producto'|'tarjeta' que tenía el panel viejo — todo es la
 * misma fila.
 */

// Código editable (Task 4.2) — mismo criterio que
// catalogo_buho_espejo_codigo_limpio del spec: no vacío tras trim,
// longitud 1-16. Vacío es válido (permite sacarle el código a un
// producto). Devuelve null si es válido, o el mensaje de error.
export function validarCodigo(valor: string): string | null {
  const v = valor.trim();
  if (v === '') return null;
  if (v.length > 16) return 'El código no puede tener más de 16 caracteres.';
  return null;
}

export function codigoNormalizado(valor: string): string | null {
  const v = valor.trim();
  return v === '' ? null : v;
}

// Códigos "propios" de un producto: el código simple, o el de cada opción
// de talles si no tiene código único (mismo criterio que
// lib/precios-familia.ts).
export function codigosDe(producto: Pick<ProductoPublico, 'codigo' | 'talles'>): string[] {
  if (producto.talles && producto.talles.length) return producto.talles.map((t) => t.codigo);
  return producto.codigo ? [producto.codigo] : [];
}

// Antes de borrar la fila de catalogo_precios de un código al eliminar un
// producto: hay que confirmar que ningún OTRO producto todavía use ese
// mismo código — pasa de verdad en este catálogo (varios productos
// distintos comparten un código del POS, ej. "11963" en varios anteojos).
export function codigosUsadosPorOtros(
  producto: Pick<ProductoPublico, 'id' | 'codigo' | 'talles'>,
  todos: Pick<ProductoPublico, 'id' | 'codigo' | 'talles'>[]
): Set<string> {
  const propios = new Set(codigosDe(producto));
  const usados = new Set<string>();
  todos.forEach((p) => {
    if (p.id === producto.id) return;
    codigosDe(p).forEach((c) => {
      if (propios.has(c)) usados.add(c);
    });
  });
  return usados;
}

// Códigos de un producto que SÍ se pueden borrar de catalogo_precios al
// eliminarlo definitivamente (los que ningún otro producto comparte).
export function codigosBorrables(
  producto: Pick<ProductoPublico, 'id' | 'codigo' | 'talles'>,
  todos: Pick<ProductoPublico, 'id' | 'codigo' | 'talles'>[]
): string[] {
  const usadosPorOtros = codigosUsadosPorOtros(producto, todos);
  return codigosDe(producto).filter((c) => !usadosPorOtros.has(c));
}

// Familia — selector único (Task 4.4), reemplaza Mundo+Subcategoría.
export function familiasVistas(productos: Pick<ProductoPublico, 'familia'>[]): string[] {
  const set = new Set<string>();
  productos.forEach((p) => {
    if (p.familia) set.add(p.familia);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

// Contador de "sin familia" (Task 4.5) — el caso de uso central del
// código editable: asignar el código correcto es lo que permite que el
// producto herede su familia real del worker en el próximo ciclo.
export function contarSinFamilia(productos: Pick<ProductoPublico, 'familia'>[]): number {
  return productos.filter((p) => !p.familia).length;
}

// Fotos que viven en el bucket 'catalogo' de Supabase Storage (subidas
// desde este panel) — a diferencia de las que son un archivo estático de
// productos/ (migradas del HTML en el Sprint 1), que no se pueden borrar
// desde acá porque no viven en Supabase.
const STORAGE_PREFIX = 'https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/';

export function rutasDeStorage(fotos: { src: string }[]): string[] {
  return fotos.filter((f) => f.src.startsWith(STORAGE_PREFIX)).map((f) => f.src.slice(STORAGE_PREFIX.length));
}

export { STORAGE_PREFIX };
