-- E12 — Límites contra pedidos abusivos.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql … envios_11_admin_columnas.sql.
--
-- `pedidos.items` es JSON libre que arma el navegador del cliente (ver
-- carrito.js: enviarAhora()). RLS le impide a un usuario tocar pedidos
-- ajenos, pero nada le impedía mandar un `items` gigante o crear pedidos sin
-- límite. Este archivo agrega dos frenos, en un trigger APARTE del de
-- envios_02 (pedidos_sellar): ese otro NUNCA rechaza el insert a propósito
-- (ver su comentario), así que un chequeo que sí tiene que poder rechazar
-- no puede vivir ahí adentro — quedaría atrapado por su `exception when
-- others` y el pedido se guardaría igual.
--
--   1. Tamaño y cantidad de items: bloquea payloads gigantes.
--   2. Tope diario por usuario: bloquea un script creando pedidos en bucle.
--      20 por día es a propósito generoso — ningún cliente real llega ahí;
--      es sólo para frenar abuso automatizado.
--
-- Si en algún momento hace falta subir el tope diario (por ejemplo, una
-- cuenta del negocio que carga pedidos telefónicos a mano), ajustar
-- v_cap_diario acá abajo.

create or replace function public.pedidos_limitar_abuso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_bytes int := 20000;
  v_max_items int := 200;
  v_cap_diario int := 20;
  v_inicio_hoy timestamptz;
  v_usados int;
begin
  if pg_column_size(new.items) > v_max_bytes then
    raise exception 'El pedido es demasiado grande.';
  end if;

  if jsonb_typeof(new.items) = 'array' and jsonb_array_length(new.items) > v_max_items then
    raise exception 'El pedido tiene demasiados items.';
  end if;

  if new.user_id is not null then
    v_inicio_hoy := (public.hoy_ar())::timestamp at time zone 'America/Argentina/Tucuman';

    select count(*) into v_usados
    from public.pedidos
    where user_id = new.user_id
      and created_at >= v_inicio_hoy;

    if v_usados >= v_cap_diario then
      raise exception 'Superaste el límite de pedidos por día. Escribinos directo por WhatsApp.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pedidos_limitar_abuso on public.pedidos;
create trigger trg_pedidos_limitar_abuso
  before insert on public.pedidos
  for each row execute function public.pedidos_limitar_abuso();
