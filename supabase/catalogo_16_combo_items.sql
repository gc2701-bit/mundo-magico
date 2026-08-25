-- Catálogo 16 — composición de combos (SPEC-catalogo-admin-variantes.md,
-- sección 3.2, diseñado por brainstorming 2026-08-25).
--
-- La composición de un combo (qué artículos y cuántos de cada uno) vive
-- hoy en Búho (QARTCOM/QARTCOM1, ver
-- handoff-worker-buho/01-contexto-y-arquitectura.md), NO en Supabase —
-- confirmado contra la base real con list_tables antes de escribir esta
-- migración, no sólo contra los .sql locales. `catalogo_buho_espejo`
-- sólo tiene `es_combo boolean`.
--
-- Esta tabla queda vacía hasta que el worker de Búho (todavía sin
-- construir, ver SPEC-catalogo-admin.md sección 8) la sincronice — mismo
-- patrón que ya usa el resto del espejo: se construye el hueco ahora, el
-- worker lo llena después. Aditiva, sin riesgo.
--
-- Un producto publicado muestra su composición cuando cualquiera de sus
-- códigos propios (el `codigo` simple o los `codigo` de `variantes`)
-- aparece como `codigo_combo` acá — no hace falta una columna `es_combo`
-- en catalogo_productos, se infiere de la presencia de filas.
create table public.catalogo_buho_espejo_combo_items (
  id                bigint generated always as identity primary key,
  codigo_combo      text not null references public.catalogo_buho_espejo(codigo) on delete cascade,
  codigo_componente text not null,
  cantidad          integer not null check (cantidad > 0),
  actualizado_en    timestamptz not null default now(),
  unique (codigo_combo, codigo_componente)
);

alter table public.catalogo_buho_espejo_combo_items enable row level security;

-- Mismo criterio que "Admin lee y edita el espejo" de
-- catalogo_05_buho_espejo.sql: sólo admin, el worker (cuando exista)
-- escribe con service_role, que bypasea RLS.
create policy "Admin lee y edita composición de combos"
  on public.catalogo_buho_espejo_combo_items
  for all using (public.es_admin()) with check (public.es_admin());

create index catalogo_buho_espejo_combo_items_combo_idx
  on public.catalogo_buho_espejo_combo_items (codigo_combo);
