'use server';

/**
 * Capa server-side única para búsqueda/filtros del catálogo (Sprint 1 del
 * rediseño de frontend, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Todo punto de entrada que filtre o busque (página de mundo, Explorar,
 * buscador predictivo del nav) pasa por acá — nunca directo a Supabase
 * desde un componente cliente. Esto es lo que la spec pide poder swapear
 * por un motor de búsqueda dedicado más adelante sin tocar UI: el día que
 * haga falta, solo cambian las dos funciones de abajo.
 *
 * `'use server'` a nivel de archivo: cada función exportada es una Server
 * Action de Next.js, invocable directo desde un Client Component (input
 * de búsqueda, checkboxes de filtro) sin armar un Route Handler aparte.
 *
 * Pega contra dos RPCs de Postgres (supabase/catalogo_12_busqueda.sql):
 * catalogo_listar (filtros sin texto libre, orden manual) y
 * catalogo_buscar (texto libre, orden por relevancia) — funciones
 * separadas a propósito, ver el comentario de esa migración. Nunca tocan
 * catalogo_buho_espejo, sólo catalogo_productos publicados (mismo
 * criterio que catalogo_publico(), ver lib/catalogo-server.ts).
 *
 * A diferencia de obtenerCatalogoPublico() (lib/catalogo-server.ts), acá
 * NO hay `next: { tags }` — los resultados son dinámicos por request
 * (query/filtros/cursor cambian todo el tiempo), no tiene sentido
 * cachearlos con ISR.
 */

import type { Foto } from './catalogo-familia';

const SUPABASE_URL = 'https://kyuilrlewynqrzebouww.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q-M5uG2ChZIg0c1zPfNXiQ_unIG1hZ8';

export type ProductoBase = {
  id: string;
  mundo: string;
  titulo: string;
  slug: string;
  codigo: string | null;
  familia: string | null;
  fotos: Foto[];
  destacadoHome: boolean;
  precioOferta: number | null;
  precio: number | null;
};

export type ProductoListado = ProductoBase & { sinStock: boolean; orden: number };
export type ProductoBuscado = ProductoBase & { score: number };

export type CursorListado = { orden: number; titulo: string; id: string };
export type CursorBusqueda = { score: number; id: string };

export type FiltrosListado = {
  mundo?: string;
  familia?: string;
  precioMin?: number;
  precioMax?: number;
  soloStock?: boolean;
  cursor?: CursorListado;
  limite?: number;
};

export type FiltrosBusqueda = {
  mundo?: string;
  familia?: string;
  cursor?: CursorBusqueda;
  limite?: number;
};

async function llamarRpc(nombre: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`No se pudo llamar a ${nombre}: ${res.status}`);
  }
  return res.json();
}

/** Filtra/pagina sin texto libre — página de un mundo, Explorar. */
export async function listarCatalogo(filtros: FiltrosListado = {}): Promise<{
  productos: ProductoListado[];
  hayMas: boolean;
}> {
  const data = (await llamarRpc('catalogo_listar', {
    p_mundo: filtros.mundo ?? null,
    p_familia: filtros.familia ?? null,
    p_precio_min: filtros.precioMin ?? null,
    p_precio_max: filtros.precioMax ?? null,
    p_solo_stock: filtros.soloStock ?? false,
    p_cursor_orden: filtros.cursor?.orden ?? null,
    p_cursor_titulo: filtros.cursor?.titulo ?? null,
    p_cursor_id: filtros.cursor?.id ?? null,
    p_limite: filtros.limite ?? 24
  })) as { productos: ProductoListado[]; hayMas: boolean };
  return data;
}

/** Búsqueda por texto libre, orden por relevancia — buscador predictivo. */
export async function buscarCatalogo(
  query: string,
  filtros: FiltrosBusqueda = {}
): Promise<{ productos: ProductoBuscado[]; hayMas: boolean }> {
  const texto = query.trim();
  if (texto.length < 2) {
    return { productos: [], hayMas: false };
  }
  const data = (await llamarRpc('catalogo_buscar', {
    p_query: texto,
    p_mundo: filtros.mundo ?? null,
    p_familia: filtros.familia ?? null,
    p_cursor_score: filtros.cursor?.score ?? null,
    p_cursor_id: filtros.cursor?.id ?? null,
    p_limite: filtros.limite ?? 10
  })) as { productos: ProductoBuscado[]; hayMas: boolean };
  return data;
}
