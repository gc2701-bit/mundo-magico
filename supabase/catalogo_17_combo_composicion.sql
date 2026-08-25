-- Catálogo 17 — combo_composicion(): función pública para leer la
-- composición de un combo (SPEC-catalogo-admin-variantes.md sección 6,
-- Sprint 6 del plan). El worker de Búho (buho-stock-sync-worker) ya
-- puebla catalogo_buho_espejo_combo_items en cada ciclo completo de sync
-- (confirmado 2026-08-25 con el equipo de ese repo — ver
-- combo-composicion-doc.json en el escritorio de Windows del usuario:
-- 54 filas escritas en producción real, 47 combos distintos). Esta
-- función es el "siguiente paso sugerido" que ese equipo dejó pendiente
-- para este repo.
--
-- catalogo_buho_espejo_combo_items no tiene nombres (sólo códigos) — el
-- nombre legible vive en catalogo_buho_espejo.nombre, que tiene RLS
-- admin-only. security definer es lo que permite a esta función leerlo
-- para un visitante público sin abrirle la tabla entera (mismo patrón
-- que catalogo_publico() en catalogo_08_stock_privado.sql/
-- catalogo_13_publico_destacados.sql).
--
-- Gate de "combo publicado": exige catalogo_buho_espejo.publicado=true
-- para el código del COMBO — la misma columna que ya pone en true el
-- flujo de activación de EspejoTab.tsx (`update catalogo_buho_espejo set
-- publicado=true`). Un combo con composición sincronizada pero todavía
-- sin activar desde el panel (el caso de los 47 combos de hoy — 0
-- publicados todavía) no expone nada. El nombre de cada componente se
-- muestra tal cual lo manda Búho (mayúsculas incluidas, sin normalizar)
-- — decisión ya tomada con el usuario, documentada por el equipo del
-- worker.
create or replace function public.combo_composicion(p_codigo text)
returns table (nombre text, cantidad integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select componente.nombre, item.cantidad
  from public.catalogo_buho_espejo_combo_items item
  join public.catalogo_buho_espejo combo on combo.codigo = item.codigo_combo and combo.publicado
  join public.catalogo_buho_espejo componente on componente.codigo = item.codigo_componente
  where item.codigo_combo = p_codigo
  order by componente.nombre;
$$;

revoke execute on function public.combo_composicion(text) from public;
grant execute on function public.combo_composicion(text) to anon, authenticated;
