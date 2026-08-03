-- E5 — Ejecución del reparto (orden de paradas, repartidor, reprogramación
-- masiva). Correr una sola vez, DESPUÉS de envios_00_base.sql,
-- envios_01_config.sql, envios_02_pedidos.sql y envios_03_estados.sql.

alter table public.pedidos
  add column if not exists orden_parada int,
  add column if not exists repartidor_id uuid references public.repartidores(id);

-- ── Reprogramación masiva (el día de lluvia) ────────────────────────────
-- Mueve todos los pedidos de un corredor en una fecha a una fecha nueva, Y
-- bloquea la fecha vieja para ese corredor — si no, entrarían pedidos
-- nuevos justo al día que se está vaciando. Todo en una función para que
-- sea atómico: si algo falla a mitad de camino, no queda medio movido.
create or replace function public.reprogramar_dia(
  p_fecha date, p_grupo_ruta text, p_nueva date, p_motivo text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movidos int;
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  update public.pedidos p
  set fecha_entrega = p_nueva
  from public.envio_zonas z
  where p.zona_id = z.id
    and z.grupo_ruta = p_grupo_ruta
    and p.fecha_entrega = p_fecha
    and p.estado not in ('entregado', 'cancelado');
  get diagnostics v_movidos = row_count;

  insert into public.envio_bloqueos (fecha, grupo_ruta, motivo)
  values (p_fecha, p_grupo_ruta, coalesce(p_motivo, 'Reprogramado'))
  on conflict (fecha, grupo_ruta) do update set motivo = excluded.motivo;

  return v_movidos;
end;
$$;

revoke execute on function public.reprogramar_dia(date, text, date, text) from public;
grant execute on function public.reprogramar_dia(date, text, date, text) to authenticated;
