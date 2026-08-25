'use client';

import { supabaseBrowser } from './supabase';

/**
 * Composición de un combo (Sprint 6 del plan de catálogo admin,
 * SPEC-catalogo-admin-variantes.md sección 6) — el worker de Búho
 * (buho-stock-sync-worker) puebla catalogo_buho_espejo_combo_items en
 * cada ciclo completo de sync (confirmado 2026-08-25: 54 filas reales en
 * producción, 47 combos). combo_composicion(codigo) — la función pública
 * de catalogo_17_combo_composicion.sql — resuelve nombre+cantidad y sólo
 * responde para combos ya activados desde el panel (publicado=true).
 *
 * Se llama con el código PROPIO del producto (el simple, o el primero de
 * sus variantes) — un combo, en la práctica, nunca tiene variantes.
 */
export type ItemComboComposicion = { nombre: string; cantidad: number };

export async function obtenerComposicionCombo(
  sb: ReturnType<typeof supabaseBrowser>,
  codigo: string
): Promise<ItemComboComposicion[]> {
  const { data, error } = await sb.rpc('combo_composicion', { p_codigo: codigo });
  if (error || !data) return [];
  return data as ItemComboComposicion[];
}
