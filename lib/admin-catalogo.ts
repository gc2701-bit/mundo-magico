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
export function codigosDe(producto: Pick<ProductoPublico, 'codigo' | 'variantes'>): string[] {
  if (producto.variantes && producto.variantes.length) return producto.variantes.map((v) => v.codigo);
  return producto.codigo ? [producto.codigo] : [];
}

// Antes de borrar la fila de catalogo_precios de un código al eliminar un
// producto: hay que confirmar que ningún OTRO producto todavía use ese
// mismo código — pasa de verdad en este catálogo (varios productos
// distintos comparten un código del POS, ej. "11963" en varios anteojos).
export function codigosUsadosPorOtros(
  producto: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>,
  todos: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>[]
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
  producto: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>,
  todos: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>[]
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

// ── Tabla de catálogo admin (Sprint 1 del plan, SPEC-catalogo-admin-variantes.md) ──

// Precio/stock por código, tal como los devuelve la RPC admin-only
// catalogo_precios_admin(codigos[]) — nunca se pide más de lo que hace
// falta (PostgREST corta en 1000 filas sin avisar, ver el comentario de
// catalogo_08_stock_privado.sql).
export type MapaPreciosAdmin = Record<string, { precio: number; stock: number | null }>;

// Precio/stock de un producto para la columna de la tabla: el mínimo
// entre sus códigos propios con dato conocido (mismo criterio de mínimo
// que resolverEstadoProducto, pero acá se muestra el número, no un texto
// formateado — esto es el panel admin, no la ficha pública). A
// diferencia del selector público, acá NO se filtra por variante
// `activo` — el admin necesita ver todo, incluso lo que sacó de la
// venta. Si ningún código tiene precio conocido, `precio` es null (no
// inventa un placeholder). Si hay precio pero ningún código tiene stock
// cargado (ej. combos, ver spec sección 8), `stock` es null.
export function precioStockDe(
  producto: Pick<ProductoPublico, 'codigo' | 'variantes'>,
  mapa: MapaPreciosAdmin
): { precio: number | null; stock: number | null } {
  const conocidos = codigosDe(producto)
    .map((c) => mapa[c])
    .filter((v): v is { precio: number; stock: number | null } => v != null);
  if (!conocidos.length) return { precio: null, stock: null };
  const precio = Math.min(...conocidos.map((v) => v.precio));
  const stocks = conocidos.map((v) => v.stock).filter((s): s is number => s != null);
  return { precio, stock: stocks.length ? Math.min(...stocks) : null };
}

// Sentinel para el filtro de Familia — "— sin familia —" no es una
// familia real, así que no puede confundirse con un valor que Búho
// mande alguna vez.
export const SIN_FAMILIA = '__sin_familia__';

export type FilaCatalogoAdmin = {
  id: string;
  codigo: string;
  titulo: string;
  familia: string | null;
  mundoSlug: string;
  mundoNombre: string;
  stock: number | null;
  precio: number | null;
  publicado: boolean;
};

export type ColumnaOrdenCatalogo = 'codigo' | 'titulo' | 'familia' | 'mundo' | 'stock' | 'precio' | 'estado';

// Orden pedido por el usuario en el brainstorming: Código · Nombre ·
// Familia · Mundo · Stock · Precio (Estado se suma al final, ya existía
// como columna antes de esta tanda). Nulls de stock/precio siempre al
// final, en cualquier dirección — un producto sin dato conocido no debe
// interrumpir el orden de los que sí lo tienen.
export function ordenarCatalogo(
  filas: FilaCatalogoAdmin[],
  columna: ColumnaOrdenCatalogo,
  direccion: 'asc' | 'desc' = 'asc'
): FilaCatalogoAdmin[] {
  const factor = direccion === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    if (columna === 'stock' || columna === 'precio') {
      const av = a[columna];
      const bv = b[columna];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * factor;
    }
    if (columna === 'estado') {
      if (a.publicado === b.publicado) return 0;
      return (a.publicado ? -1 : 1) * factor;
    }
    const av = columna === 'mundo' ? a.mundoNombre : columna === 'familia' ? a.familia || '' : a[columna];
    const bv = columna === 'mundo' ? b.mundoNombre : columna === 'familia' ? b.familia || '' : b[columna];
    return av.localeCompare(bv, 'es') * factor;
  });
}

// Búsqueda libre (código + título) + Familia (con SIN_FAMILIA) + Mundo —
// sin filtro de stock/precio, decidido en brainstorming (stock es sólo
// lectura desde Búho, precio se ordena por columna pero no se acota por
// rango en esta tanda).
export function filtrarCatalogo(
  filas: FilaCatalogoAdmin[],
  opts: { busqueda?: string; familia?: string; mundoSlug?: string }
): FilaCatalogoAdmin[] {
  const q = (opts.busqueda || '').trim().toLowerCase();
  return filas.filter((f) => {
    if (opts.familia) {
      if (opts.familia === SIN_FAMILIA ? !!f.familia : f.familia !== opts.familia) return false;
    }
    if (opts.mundoSlug && f.mundoSlug !== opts.mundoSlug) return false;
    if (!q) return true;
    return f.titulo.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q);
  });
}

// ── Selección múltiple + acciones en lote (Sprint 2 del plan) ──

// Estado del checkbox del encabezado: tri-state entre "ninguno de los
// filtrados está seleccionado", "todos" y "algunos". Sólo mira las filas
// que pasan el filtro actual — seleccionar "todos" nunca incluye algo que
// el filtro está ocultando.
export function estadoSeleccionEncabezado(
  filas: FilaCatalogoAdmin[],
  seleccionados: Set<string>
): 'ninguno' | 'algunos' | 'todos' {
  if (!filas.length) return 'ninguno';
  const enFilas = filas.filter((f) => seleccionados.has(f.id)).length;
  if (enFilas === 0) return 'ninguno';
  if (enFilas === filas.length) return 'todos';
  return 'algunos';
}

// Ajuste de precio en lote: redondea al entero más cercano, nunca deja el
// precio en 0 o negativo (violaría el check `precio > 0` de
// catalogo_precios) aunque el porcentaje sea muy negativo.
export function redondearPrecio(precioActual: number, porcentaje: number): number {
  return Math.max(1, Math.round(precioActual * (1 + porcentaje / 100)));
}

// Códigos borrables de un LOTE completo: a diferencia de codigosBorrables
// (un producto contra el resto), acá un código es borrable si ningún
// producto FUERA del lote lo usa — si dos seleccionados comparten un
// código, no alcanza con mirarlos de a uno (ver el bug que esto evita:
// borrar de a uno con la misma lista `todos` sin actualizar deja
// catalogo_precios con filas huérfanas cuando el otro producto del lote
// ya se borró antes).
export function codigosBorrablesLote(
  seleccionados: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>[],
  todos: Pick<ProductoPublico, 'id' | 'codigo' | 'variantes'>[]
): string[] {
  const idsSeleccionados = new Set(seleccionados.map((p) => p.id));
  const otros = todos.filter((p) => !idsSeleccionados.has(p.id));
  const propios = new Set(seleccionados.flatMap((p) => codigosDe(p)));
  const usadosPorOtros = new Set(otros.flatMap((p) => codigosDe(p)));
  return Array.from(propios).filter((c) => !usadosPorOtros.has(c));
}
