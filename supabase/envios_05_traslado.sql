-- E6 — Traslado Centro → Yerba Buena.
-- Correr una sola vez, DESPUÉS de envios_00 a envios_04.
--
-- Casi todo el mecanismo ya existe (E1: sucursales.requiere_transferencia;
-- E4: en_transito ya es un paso válido para retiro+transferencia; E5: el
-- corredor oeste ya agrupa por corredor). Esta migración es el pegamento
-- que faltaba: un retiro en una sucursal que requiere traslado necesita un
-- día más de anticipación, y eso hoy no lo sabía ni cupos_disponibles() ni
-- el trigger de sellado.

drop function if exists public.cupos_disponibles(date, date, uuid);

create or replace function public.cupos_disponibles(p_desde date, p_hasta date, p_zona_id uuid, p_sucursal_id uuid default null)
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
  v_lead int;
begin
  select * into v_zona from public.envio_zonas where id = p_zona_id;
  select * into v_cfg from public.envio_config where id = 1;
  v_admin := public.es_admin();

  v_lead := coalesce(v_cfg.lead_dias, 1);
  if p_sucursal_id is not null then
    v_lead := v_lead + (select case when requiere_transferencia then 1 else 0 end from public.sucursales where id = p_sucursal_id);
  end if;

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
      when dd.f < public.hoy_ar() + v_lead then 'sin_anticipacion'
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

revoke execute on function public.cupos_disponibles(date, date, uuid, uuid) from public;
grant execute on function public.cupos_disponibles(date, date, uuid, uuid) to anon, authenticated;

-- pedidos_sellar: el mismo día extra, del lado del servidor (última
-- palabra, no depende de que el cliente haya preguntado bien).
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
  v_lead int;
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
    v_lead := coalesce(v_cfg.lead_dias, 1);

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
        if v_suc.requiere_transferencia then v_lead := v_lead + 1; end if;
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
      elsif new.fecha_entrega < public.hoy_ar() + v_lead then
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
    new.necesita_revision := true;
    new.motivo_revision := array_append(coalesce(new.motivo_revision, '{}'), 'error_al_calcular');
  end;

  return new;
end;
$$;
