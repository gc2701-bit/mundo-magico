/**
 * Helpers de cursor para lib/busqueda.ts, en un archivo aparte a
 * propósito: un módulo `'use server'` sólo puede exportar funciones
 * async (Server Actions) — estas son puras y síncronas, no califican.
 */
import type { ProductoListado, ProductoBuscado, CursorListado, CursorBusqueda } from './busqueda';

/** Cursor para pedir la próxima página de listarCatalogo(), a partir del
 * último producto ya recibido. */
export function siguienteCursorListado(productos: ProductoListado[]): CursorListado | undefined {
  const ultimo = productos.at(-1);
  if (!ultimo) return undefined;
  return { orden: ultimo.orden, titulo: ultimo.titulo, id: ultimo.id };
}

/** Cursor para pedir la próxima página de buscarCatalogo(). */
export function siguienteCursorBusqueda(productos: ProductoBuscado[]): CursorBusqueda | undefined {
  const ultimo = productos.at(-1);
  if (!ultimo) return undefined;
  return { score: ultimo.score, id: ultimo.id };
}
