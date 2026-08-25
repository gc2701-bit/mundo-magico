/**
 * Selector de variantes talle×tipo de la ficha pública (Sprint 5 del plan
 * de catálogo admin, SPEC-catalogo-admin-variantes.md sección 6) —
 * funciones puras, sin DOM. El componente (AccionesProducto.tsx) las usa
 * para el filtrado mutuo entre ejes y para resolver una combinación
 * completa a su variante real.
 *
 * Una variante `activo:false` ("sacada de la venta" desde el panel
 * admin) nunca se ofrece como opción acá — sigue guardada, pero el
 * visitante no puede elegirla.
 */
import type { Variante } from './catalogo-familia';

export type Eje = 'talle' | 'tipo';
export type Seleccion = { talle: string | null; tipo: string | null };

// Valores distintos de un eje entre variantes activas.
export function valoresDeEje(variantes: Variante[], eje: Eje): string[] {
  const set = new Set<string>();
  variantes.forEach((v) => {
    const val = v[eje];
    if (v.activo && val) set.add(val);
  });
  return Array.from(set);
}

// Un eje sólo pide elección si tiene más de un valor posible entre las
// activas — si todas comparten el mismo talle (o ninguna tiene talle),
// no hay nada que elegir ahí.
export function ejeElegible(variantes: Variante[], eje: Eje): boolean {
  return valoresDeEje(variantes, eje).length > 1;
}

// Selección inicial: un eje con exactamente un valor posible arranca
// resuelto solo (nada que elegir); el resto arranca sin elegir.
export function seleccionInicial(variantes: Variante[]): Seleccion {
  const talles = valoresDeEje(variantes, 'talle');
  const tipos = valoresDeEje(variantes, 'tipo');
  return {
    talle: talles.length === 1 ? talles[0] : null,
    tipo: tipos.length === 1 ? tipos[0] : null
  };
}

// Valores del eje pedido que siguen siendo alcanzables dado lo ya
// elegido del OTRO eje — filtrado mutuo: nunca ofrece una combinación
// que no existe entre las variantes activas.
export function valoresAlcanzables(variantes: Variante[], eje: Eje, seleccion: Seleccion): string[] {
  const otro: Eje = eje === 'talle' ? 'tipo' : 'talle';
  const otroValor = seleccion[otro];
  const candidatas = otroValor == null ? variantes : variantes.filter((v) => v[otro] === otroValor);
  return valoresDeEje(candidatas, eje);
}

// true cuando cada eje elegible ya tiene un valor asignado — recién ahí
// resolverVariante() puede confiar en un único match.
export function seleccionCompleta(variantes: Variante[], seleccion: Seleccion): boolean {
  return (
    (!ejeElegible(variantes, 'talle') || seleccion.talle != null) &&
    (!ejeElegible(variantes, 'tipo') || seleccion.tipo != null)
  );
}

// La variante activa que matchea la selección completa — null si la
// selección todavía está incompleta, o (no debería pasar con datos
// consistentes) si no existe esa combinación.
export function resolverVariante(variantes: Variante[], seleccion: Seleccion): Variante | null {
  if (!seleccionCompleta(variantes, seleccion)) return null;
  const tallesMultiples = ejeElegible(variantes, 'talle');
  const tiposMultiples = ejeElegible(variantes, 'tipo');
  const match = variantes.find((v) => {
    if (!v.activo) return false;
    if (tallesMultiples && v.talle !== seleccion.talle) return false;
    if (tiposMultiples && v.tipo !== seleccion.tipo) return false;
    return true;
  });
  return match || null;
}

// Etiqueta legible de una variante para el carrito/aria-label — combina
// talle y tipo cuando los dos existen ("Chico · Rojo"), o el que haya.
export function etiquetaVariante(v: Pick<Variante, 'talle' | 'tipo'>): string {
  return [v.talle, v.tipo].filter(Boolean).join(' · ');
}
