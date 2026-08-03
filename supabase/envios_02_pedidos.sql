-- E3 — Captura completa del pedido + RPC de cupos.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql y envios_01_config.sql.
--
-- Agrega a `pedidos` los campos de envío estructurado (zona, franja,
-- sucursal, tamaño, revisión) y dos piezas de lógica del lado del servidor:
--
--   1. cupos_disponibles(desde, hasta, zona_id) — lo que el carrito
--      consulta para pintar los días llenos. Devuelve una fila por FECHA
--      (no por franja): el cupo vive en envio_cupos por corredor × día de
--      la semana, no por franja horaria, así que la franja no agrega una
--      dimensión de capacidad propia — sólo es una preferencia de horario
--      que ya resuelve MMEnvios.franjas(isodow) del lado del cliente.
--
--   2. pedidos_sellar() — trigger BEFORE INSERT que completa zona_nombre,
--      costo_envio y sucursal_armado, y vuelve a correr las mismas reglas
--      de cupos_disponibles para decidir si hace falta revisión manual.
--      NUNCA rechaza el insert: si algo de esto falla, marca
--      necesita_revision y deja pasar la fila igual (ver comentario en
--      el bloque exception más abajo).
--
-- No reescribe la columna `zona` (texto libre) de pedidos viejos: agrega
-- zona_id + zona_nombre y los completa por coincidencia de alias donde se
-- pueda. Lo que no coincide (el "San Miguel de Tucumán" viejo, ambiguo
-- entre corredores) queda con zona_id null a propósito, para revisar a
-- mano — el texto original en `zona` no se toca nunca.

alter table public.pedidos
  add column if not exists numero bigint,
  add column if not exists zona_id uuid references public.envio_zonas(id),
  add column if not exists zona_nombre text,
  add column if not exists costo_envio numeric,
  add column if not exists franja_id uuid references public.envio_franjas(id),
  add column if not exists sucursal_id uuid references public.sucursales(id),
  add column if not exists sucursal_armado uuid references public.sucursales(id),
  add column if not exists entre_calles text,
  add column if not exists piso_depto text,
  add column if not exists receptor_nombre text,
  add column if not exists receptor_telefono text,
  add column if not exists bultos text check (bultos in ('chico', 'mediano', 'grande')),
  add column if not exists necesita_revision boolean not null default false,
  add column if not exists motivo_revision text[] not null default '{}',
  add column if not exists actualizado_at timestamptz not null default now();

create sequence if not exists public.pedidos_numero_seq start with 1000;
create unique index if not exists pedidos_numero_idx on public.pedidos (numero) where numero is not null;

-- Backfill de zona_id por alias, sólo donde hay una coincidencia exacta e
-- inequívoca. No toca la columna `zona` original.
update public.pedidos p
set zona_id = z.id, zona_nombre = z.nombre
from public.envio_zonas z
where p.zona_id is null
  and p.metodo_entrega = 'envio'
  and p.zona is not null
  and p.zona = any (z.alias);

-- ── actualizado_at se toca solo en cada UPDATE ──────────────────────────
create or replace function public.pedidos_tocar_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pedidos_actualizado on public.pedidos;
create trigger trg_pedidos_actualizado
  before update on public.pedidos
  for each row execute function public.pedidos_tocar_actualizado();

-- ── cupos_disponibles ────────────────────────────────────────────────────
create or replace function public.cupos_disponibles(p_desde date, p_hasta date, p_zona_id uuid)
returns table (
  fecha date,
  disponible boolean,
  motivo text,
  cupo_pedidos int,
  cupo_bultos int,
  pedidos_usados int,
  bultos_usados int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_zona public.envio_zonas%rowtype;
  v_cfg public.envio_config%rowtype;
  v_admin boolean;
begin
  select * into v_zona from public.envio_zonas where id = p_zona_id;
  select * into v_cfg from public.envio_config where id = 1;
  v_admin := public.es_admin();

  return query
  with dias as (
    select d::date as f, extract(isodow from d)::int as dow
    from generate_series(p_desde, p_hasta, interval '1 day') as d
  ),
  usados as (
    select p.fecha_entrega as f, count(*)::int as n_pedidos,
      coalesce(sum(case p.bultos when 'chico' then 1 when 'mediano' then 2 when 'grande' then 3 else 1 end), 0)::int as n_bultos
    from public.pedidos p
    join public.envio_zonas z on z.id = p.zona_id
    where v_zona.id is not null and z.grupo_ruta = v_zona.grupo_ruta
      and p.estado <> 'cancelado'
      and p.fecha_entrega between p_desde and p_hasta
    group by p.fecha_entrega
  )
  select
    dd.f,
    (m.motivo is null),
    m.motivo,
    case when v_admin then ec.cupo_pedidos end,
    case when v_admin then ec.cupo_bultos end,
    case when v_admin then coalesce(u.n_pedidos, 0) end,
    case when v_admin then coalesce(u.n_bultos, 0) end
  from dias dd
  left join public.envio_cupos ec
    on v_zona.id is not null and ec.grupo_ruta = v_zona.grupo_ruta and ec.dia_semana = dd.dow
  left join usados u on u.f = dd.f
  left join lateral (
    select case
      when dd.f < public.hoy_ar() then 'pasada'
      when dd.dow = 7 then 'domingo'
      when dd.f < public.hoy_ar() + coalesce(v_cfg.lead_dias, 1) then 'sin_anticipacion'
      when dd.f > public.hoy_ar() + coalesce(v_cfg.horizonte_dias, 14) then 'fuera_de_horizonte'
      when v_zona.id is not null and exists (
        select 1 from public.envio_bloqueos b
        where b.fecha = dd.f and (b.grupo_ruta is null or b.grupo_ruta = v_zona.grupo_ruta)
      ) then 'bloqueada'
      when v_zona.id is not null and coalesce(v_cfg.dias_fijos_activos, false)
        and not (dd.dow = any (v_zona.dias_semana)) then 'zona_no_reparte_ese_dia'
      when ec.cupo_pedidos is not null and coalesce(u.n_pedidos, 0) >= ec.cupo_pedidos then 'cupo_pedidos'
      when ec.cupo_bultos is not null and coalesce(u.n_bultos, 0) >= ec.cupo_bultos then 'cupo_bultos'
      else null
    end as motivo
  ) m on true
  order by dd.f;
end;
$$;

revoke execute on function public.cupos_disponibles(date, date, uuid) from public;
grant execute on function public.cupos_disponibles(date, date, uuid) to anon, authenticated;

-- ── pedidos_sellar: BEFORE INSERT, nunca rechaza ────────────────────────
create or replace function public.pedidos_sellar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_zona public.envio_zonas%rowtype;
  v_cfg public.envio_config%rowtype;
  v_suc public.sucursales%rowtype;
  v_cupo public.envio_cupos%rowtype;
  v_deposito uuid;
  v_dow int;
  v_usados_pedidos int;
  v_usados_bultos int;
  v_este_bulto int;
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.numero is null then
    new.numero := nextval('public.pedidos_numero_seq');
  end if;
  new.necesita_revision := coalesce(new.necesita_revision, false);
  new.motivo_revision := coalesce(new.motivo_revision, '{}');

  begin
    select * into v_cfg from public.envio_config where id = 1;
    select id into v_deposito from public.sucursales where es_deposito limit 1;

    if new.zona_id is not null then
      select * into v_zona from public.envio_zonas where id = new.zona_id;
    end if;

    if found and new.zona_id is not null then
      new.zona_nombre := v_zona.nombre;
      if coalesce(v_cfg.cobrar_envio, true) then
        select costo into new.costo_envio from public.envio_tarifas where id = v_zona.tarifa_id;
      else
        new.costo_envio := 0;
      end if;
    end if;

    if new.metodo_entrega = 'retiro' and new.sucursal_id is not null then
      select * into v_suc from public.sucursales where id = new.sucursal_id;
      if found then
        new.sucursal_armado := case when v_suc.requiere_transferencia then v_deposito else new.sucursal_id end;
      end if;
    elsif new.metodo_entrega = 'envio' then
      new.sucursal_armado := v_deposito;
    end if;

    if new.fecha_entrega is not null then
      v_dow := extract(isodow from new.fecha_entrega)::int;
      v_este_bulto := case new.bultos when 'chico' then 1 when 'mediano' then 2 when 'grande' then 3 else 1 end;

      if new.fecha_entrega < public.hoy_ar() then
        new.necesita_revision := true;
        new.motivo_revision := array_append(new.motivo_revision, 'pasada');
      elsif v_dow = 7 then
        new.necesita_revision := true;
        new.motivo_revision := array_append(new.motivo_revision, 'domingo');
      elsif new.fecha_entrega < public.hoy_ar() + coalesce(v_cfg.lead_dias, 1) then
        new.necesita_revision := true;
        new.motivo_revision := array_append(new.motivo_revision, 'sin_anticipacion');
      elsif new.fecha_entrega > public.hoy_ar() + coalesce(v_cfg.horizonte_dias, 14) then
        new.necesita_revision := true;
        new.motivo_revision := array_append(new.motivo_revision, 'fuera_de_horizonte');
      end if;

      if new.zona_id is not null then
        if exists (
          select 1 from public.envio_bloqueos b
          where b.fecha = new.fecha_entrega and (b.grupo_ruta is null or b.grupo_ruta = v_zona.grupo_ruta)
        ) then
          new.necesita_revision := true;
          new.motivo_revision := array_append(new.motivo_revision, 'bloqueada');
        end if;

        if coalesce(v_cfg.dias_fijos_activos, false) and not (v_dow = any (v_zona.dias_semana)) then
          new.necesita_revision := true;
          new.motivo_revision := array_append(new.motivo_revision, 'zona_no_reparte_ese_dia');
        end if;

        select * into v_cupo from public.envio_cupos
        where grupo_ruta = v_zona.grupo_ruta and dia_semana = v_dow;

        if found then
          select count(*),
            coalesce(sum(case p.bultos when 'chico' then 1 when 'mediano' then 2 when 'grande' then 3 else 1 end), 0)
          into v_usados_pedidos, v_usados_bultos
          from public.pedidos p
          join public.envio_zonas z on z.id = p.zona_id
          where z.grupo_ruta = v_zona.grupo_ruta
            and p.fecha_entrega = new.fecha_entrega
            and p.estado <> 'cancelado';

          if v_usados_pedidos + 1 > v_cupo.cupo_pedidos then
            new.necesita_revision := true;
            new.motivo_revision := array_append(new.motivo_revision, 'cupo_pedidos');
          end if;
          if v_usados_bultos + v_este_bulto > v_cupo.cupo_bultos then
            new.necesita_revision := true;
            new.motivo_revision := array_append(new.motivo_revision, 'cupo_bultos');
          end if;
        end if;
      end if;
    end if;

  exception when others then
    -- El pedido SIEMPRE se guarda: si cualquier cálculo de arriba falla
    -- (una tabla de configuración vacía, un dato inesperado), se anota para
    -- revisar a mano en vez de perder el pedido.
    new.necesita_revision := true;
    new.motivo_revision := array_append(coalesce(new.motivo_revision, '{}'), 'error_al_calcular');
  end;

  return new;
end;
$$;

drop trigger if exists trg_pedidos_sellar on public.pedidos;
create trigger trg_pedidos_sellar
  before insert on public.pedidos
  for each row execute function public.pedidos_sellar();
