'use client';

import { supabaseBrowser } from './supabase';

/**
 * Fetch compartido de catalogo_publico() para componentes cliente que
 * necesitan precio/stock en vivo — CatalogoPrecios.tsx (hidrata el DOM
 * de toda la página) y AgregarControl (Sprint 5: precio de la variante
 * elegida en la ficha de producto). Cacheado a nivel de módulo para que
 * las dos (o más) llamadas por página compartan un solo viaje de red en
 * vez de pedir la misma respuesta dos veces.
 *
 * `catalogo_publico()` es `stable` (Postgres) — misma respuesta en la
 * misma transacción/página, así que cachear a nivel de módulo (dura
 * mientras la pestaña esté abierta, no por request) es seguro: no hay
 * escritura del cliente que dependa de ver el precio más fresco posible
 * dentro de la misma carga de página.
 */
export type PreciosPublico = {
  precios: Record<string, number>;
  sinStock: Record<string, boolean>;
  pocasUnidades: Record<string, boolean>;
};

let promesa: Promise<PreciosPublico> | null = null;

export function obtenerPreciosPublicos(): Promise<PreciosPublico> {
  if (!promesa) {
    // Promise.resolve(...) a propósito: el builder de supabase-js es
    // sólo PromiseLike (no expone .catch), envolverlo en un Promise real
    // es lo que permite encadenar el manejo de error de acá abajo.
    promesa = Promise.resolve(supabaseBrowser().rpc('catalogo_publico'))
      .then(({ data, error }: { data: any; error: any }) => {
        if (error || !data) throw error || new Error('catalogo_publico() sin datos');
        const sinStock: Record<string, boolean> = {};
        (data.sinStock || []).forEach((c: string) => { sinStock[c] = true; });
        const pocasUnidades: Record<string, boolean> = {};
        (data.pocasUnidades || []).forEach((c: string) => { pocasUnidades[c] = true; });
        return { precios: data.precios || {}, sinStock, pocasUnidades };
      })
      .catch((err: unknown) => {
        promesa = null; // permite reintentar en el próximo llamado si falló
        throw err;
      });
  }
  return promesa;
}
