/**
 * Resolución de precio/stock por producto (Sprint 2, Task 2.3) — versión
 * para el catálogo nuevo (Next.js). Más simple que assets/precios.js: acá
 * un producto YA es un dato estructurado (codigo o talles, nunca texto
 * ambiguo de HTML) — no hace falta la cascada de "de dónde saco el
 * código" que necesitaba una tarjeta escrita a mano.
 *
 * Funciones puras — sin fetch, sin DOM. El fetch en sí vive en
 * lib/catalogo-cliente.ts (Client Component).
 */
import type { ProductoPublico } from './catalogo-familia';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export type PreciosMapa = Record<string, number>;

export type EstadoPrecio = {
  texto: string | null; // null = sin precio todavía (código no vino en la respuesta)
  sinStock: boolean;
  pocasUnidades: boolean;
};

function formatear(n: number): string {
  return fmt.format(n);
}

// Un producto simple (codigo) resuelve directo. Uno de talles resuelve el
// MÍNIMO de sus opciones con precio conocido — "Desde $X", igual criterio
// que ya usa el sitio para combos/talles con precios distintos por opción.
export function resolverEstadoProducto(
  producto: Pick<ProductoPublico, 'codigo' | 'talles'>,
  precios: PreciosMapa,
  sinStock: Record<string, boolean>,
  pocasUnidades: Record<string, boolean>
): EstadoPrecio {
  const codigos = producto.talles && producto.talles.length
    ? producto.talles.map((t) => t.codigo)
    : producto.codigo
      ? [producto.codigo]
      : [];

  if (!codigos.length) return { texto: null, sinStock: false, pocasUnidades: false };

  const conocidos = codigos.filter((c) => precios[c] != null);
  if (!conocidos.length) return { texto: null, sinStock: false, pocasUnidades: false };

  const min = Math.min(...conocidos.map((c) => precios[c]));
  const esRango = producto.talles != null && producto.talles.length > 1;
  const texto = esRango ? 'Desde ' + formatear(min) : formatear(min);

  // Sin stock: sólo si TODOS los códigos que se conocen están sin stock
  // (mismo criterio que assets/precios.js marcarEstado — un talle
  // disponible ya alcanza para no marcar el producto entero agotado).
  const todosSinStock = codigos.length > 0 && codigos.every((c) => !!sinStock[c]);
  const algunaPoca = codigos.some((c) => !!pocasUnidades[c]);

  return { texto, sinStock: todosSinStock, pocasUnidades: !todosSinStock && algunaPoca };
}
