-- E12 — Cuenta de repartidor: ve SÓLO su ruta del día y marca entregado /
-- ausente desde el celular.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql … envios_09_inmediato.sql.
--
-- Hasta ahora todo cambio de estado lo hacía un admin desde admin-pedidos:
-- el repartidor llamaba o mandaba mensaje al local y alguien tildaba por él.
-- Eso agrega una persona y un retraso a cada entrega, y hace que el historial
-- diga "lo marcó la cuenta del negocio" cuando en realidad lo entregó otro.
--
-- DECISIÓN DE SEGURIDAD (la parte importante de este archivo):
-- al repartidor NO se le da ninguna política de RLS sobre `pedidos`. Ni
-- select ni update. Todo pasa por dos funciones `security definer`:
--
--   * mi_ruta_hoy()          — devuelve sólo las columnas que hacen falta
--                              para repartir. RLS es por FILA, no por
--                              columna: una política de select le habría
--                              dado también user_id, items, precios y notas
--                              internas de sus pedidos. La función elige
--                              columna por columna qué sale.
--   * repartidor_marcar()    — el único camino de escritura, y sólo puede
--                              escribir `estado` (+ motivo_ausente) de un
--                              pedido asignado a ÉL y con fecha de HOY.
--                              Así un repartidor no puede tocar la fecha, la
--                              zona, el precio ni el pedido de un compañero,
--                              aunque le pase cualquier cosa al JS del
--                              celular o alguien juegue con la consola.
--
-- El trigger de auditoría de envios_03 ya guarda el actor del JWT, así que
-- cada marca queda firmada con la cuenta del repartidor sin tocar nada más.

-- ── Ligar un repartidor a una cuenta ────────────────────────────────────
-- Igual que `admins`: la persona se crea la cuenta desde el sitio como
-- cualquier cliente, y después se le pega el user_id acá a mano (Supabase →
-- Authentication → Users → User UID). Nullable a propósito: la cadetería
-- tercerizada sigue existiendo como repartidor sin cuenta.
alter table public.repartidores
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists repartidores_user_id_idx
  on public.repartidores (user_id) where user_id is not null;

-- ── ¿Qué repartidor es el que llama? ────────────────────────────────────
-- Devuelve el id de repartidor de la sesión actual, o null si esa cuenta no
-- es repartidor (o está desactivada: un repartidor que dejó de trabajar
-- pierde el acceso con sólo destildar `activo`, sin borrar su historial).
create or replace function public.mi_repartidor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.repartidores
  where user_id = (select auth.uid()) and activo
  limit 1;
$$;

revoke execute on function public.mi_repartidor_id() from public, anon;
grant execute on function public.mi_repartidor_id() to authenticated;

-- ── La ruta del día ─────────────────────────────────────────────────────
-- Sólo los pedidos de hoy (hoy_ar(), no now(): ver envios_00_base.sql) que
-- todavía están vivos. Un pedido ya entregado o cancelado desaparece de la
-- lista — la pantalla del celular es una lista de trabajo pendiente, no un
-- historial.
--
-- `orden_parada` manda el orden, igual que la hoja de ruta impresa: el
-- repartidor ve las paradas en el mismo orden que armó el panel.
create or replace function public.mi_ruta_hoy()
returns table (
  id uuid,
  numero bigint,
  orden_parada int,
  estado text,
  metodo_entrega text,
  nombre text,
  telefono text,
  direccion text,
  entre_calles text,
  piso_depto text,
  zona_nombre text,
  bultos text,
  receptor_nombre text,
  receptor_telefono text,
  nota text,
  intentos_entrega int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id, p.numero, p.orden_parada, p.estado, p.metodo_entrega,
    p.nombre, p.telefono, p.direccion, p.entre_calles, p.piso_depto,
    p.zona_nombre, p.bultos, p.receptor_nombre, p.receptor_telefono,
    p.nota, p.intentos_entrega
  from public.pedidos p
  where p.repartidor_id = public.mi_repartidor_id()
    and p.fecha_entrega = public.hoy_ar()
    and p.estado not in ('entregado', 'cancelado')
  order by p.orden_parada nulls last, p.numero;
$$;

revoke execute on function public.mi_ruta_hoy() from public, anon;
grant execute on function public.mi_ruta_hoy() to authenticated;

-- ── Marcar una parada ───────────────────────────────────────────────────
-- Transiciones permitidas al repartidor, deliberadamente pocas: sólo lo que
-- pasa en la calle. Confirmar, preparar, reprogramar o cancelar sigue siendo
-- del admin — el repartidor no debería poder cerrar un pedido que nunca
-- cargó en el auto.
--
--   listo | en_reparto            → entregado
--   listo | en_reparto            → ausente   (con motivo obligatorio)
--   listo                         → en_reparto  (arrancó el recorrido)
--
-- Devuelve el estado nuevo. Si algo no cierra levanta excepción con un texto
-- legible: el JS del celular lo muestra tal cual.
create or replace function public.repartidor_marcar(
  p_pedido_id uuid,
  p_estado text,
  p_motivo text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rep uuid;
  v_actual text;
begin
  v_rep := public.mi_repartidor_id();
  if v_rep is null then
    raise exception 'Esta cuenta no es un repartidor activo';
  end if;

  -- El for update y las condiciones de dueño/fecha van juntos: si el pedido
  -- no es de este repartidor o no es de hoy, no aparece y corta acá. Es la
  -- misma frontera que mi_ruta_hoy(), repetida a propósito — la escritura no
  -- confía en que el cliente haya leído la lista correcta.
  select estado into v_actual
  from public.pedidos
  where id = p_pedido_id
    and repartidor_id = v_rep
    and fecha_entrega = public.hoy_ar()
  for update;

  if not found then
    raise exception 'Ese pedido no está en tu ruta de hoy';
  end if;

  if p_estado = 'ausente' then
    if p_motivo is null or p_motivo not in (
      'nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo',
      'zona_inundada', 'vehiculo', 'otro'
    ) then
      raise exception 'Falta el motivo de la visita fallida';
    end if;
    if v_actual not in ('listo', 'en_reparto') then
      raise exception 'Este pedido ya no se puede marcar como ausente (está %)', v_actual;
    end if;
    update public.pedidos
      set estado = 'ausente', motivo_ausente = p_motivo
      where id = p_pedido_id;

  elsif p_estado = 'entregado' then
    if v_actual not in ('listo', 'en_reparto') then
      raise exception 'Este pedido no está para entregar (está %)', v_actual;
    end if;
    update public.pedidos set estado = 'entregado' where id = p_pedido_id;

  elsif p_estado = 'en_reparto' then
    if v_actual <> 'listo' then
      raise exception 'Sólo un pedido listo puede salir a reparto (está %)', v_actual;
    end if;
    update public.pedidos set estado = 'en_reparto' where id = p_pedido_id;

  else
    raise exception 'Un repartidor no puede poner el estado "%"', p_estado;
  end if;

  return p_estado;
end;
$$;

revoke execute on function public.repartidor_marcar(uuid, text, text) from public, anon;
grant execute on function public.repartidor_marcar(uuid, text, text) to authenticated;

-- ── Alta de un repartidor con cuenta (para hacer a mano) ────────────────
-- 1. La persona se crea la cuenta desde el sitio (o se la crea el admin).
-- 2. Supabase → Authentication → Users → copiar su User UID.
-- 3. Si el repartidor ya existe en la tabla:
--      update public.repartidores set user_id = 'UUID-DE-LA-CUENTA'
--      where nombre = 'Nombre del repartidor';
--    Si es nuevo:
--      insert into public.repartidores (nombre, tipo, telefono, user_id)
--      values ('Nombre', 'propio', '381...', 'UUID-DE-LA-CUENTA');
-- 4. Mandarle el link de ruta.html. No necesita nada más: si la cuenta no
--    está ligada a un repartidor activo, la página se lo dice y no muestra
--    ningún dato.
