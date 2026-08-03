-- E8 — Escala y mantenimiento.
-- Correr una sola vez, DESPUÉS de envios_00 a envios_06.

alter table public.pedidos add column if not exists archivado boolean not null default false;

-- Índice parcial: las consultas del día a día casi siempre filtran
-- "not archivado" — este índice les sirve sin cargar las filas archivadas.
create index if not exists pedidos_no_archivado_idx on public.pedidos (fecha_entrega) where not archivado;

-- Guarda es_admin() adentro (no sólo en el grant) porque esto lo dispara un
-- botón del panel, no una migración: cualquier cuenta autenticada podría
-- intentar llamarlo directo por la API.
create or replace function public.archivar_pedidos_viejos(p_dias int)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  update public.pedidos
  set archivado = true
  where not archivado
    and estado in ('entregado', 'cancelado')
    and coalesce(fecha_entrega, created_at::date) < (public.hoy_ar() - p_dias);
  get diagnostics v_n = row_count;

  return v_n;
end;
$$;

revoke execute on function public.archivar_pedidos_viejos(int) from public;
grant execute on function public.archivar_pedidos_viejos(int) to authenticated;
