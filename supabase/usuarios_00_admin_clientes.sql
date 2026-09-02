-- Usuarios 00 — RPCs de gestión de administradores y clientes, para
-- /admin/usuarios (Sprint D del dashboard admin, ver SPEC-dashboard-admin.md
-- y tasks/plan-dashboard-admin.md). Correr en el proyecto de catálogo/
-- pedidos (kyuilrlewynqrzebouww), DESPUÉS de envios_00_base.sql (necesita
-- public.es_admin()) y catalogo_20_revalidar_debounce.sql (por orden, no
-- por dependencia real).
--
-- Primer archivo con prefijo `usuarios_` — hasta ahora esto vivía repartido
-- entre pedidos_envio.sql (tabla admins) y envios_00_base.sql (es_admin());
-- se junta acá porque es, en sí mismo, un dominio nuevo (gestión de
-- cuentas), no una extensión de envíos ni de catálogo.

-- ── Admins: hoy sólo hay una policy de SELECT ("un admin se ve a si
-- mismo", pedidos_envio.sql) — nunca hubo forma de agregar/quitar un admin
-- desde el cliente, se hacía a mano en el dashboard de Supabase (ver
-- memoria del proyecto, sesión 2026-08-26). En vez de abrir INSERT/DELETE
-- por RLS (superficie más grande, sólo protegida por la condición de la
-- policy), se resuelve con funciones security definer que chequean
-- es_admin() adentro — mismo patrón que catalogo_precios_admin()/
-- mi_ruta_hoy(): la restricción real vive en la función, el GRANT es sólo
-- "puede intentarlo".

-- Listar admins con su email — auth.users no es visible al cliente directo.
create or replace function public.admin_listar_admins()
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.user_id, u.email
  from public.admins a
  join auth.users u on u.id = a.user_id
  where public.es_admin()
  order by u.email;
$$;

revoke execute on function public.admin_listar_admins() from public, anon;
grant execute on function public.admin_listar_admins() to authenticated;

-- Buscar una cuenta por email para agregarla como admin. 0 filas = no
-- existe ninguna cuenta con ese email (el panel muestra ese mensaje).
create or replace function public.admin_buscar_usuario_por_email(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.email
  from auth.users u
  where public.es_admin()
    and lower(u.email) = lower(btrim(p_email));
$$;

revoke execute on function public.admin_buscar_usuario_por_email(text) from public, anon;
grant execute on function public.admin_buscar_usuario_por_email(text) to authenticated;

-- Agregar es idempotente (on conflict do nothing: buscar → ya está en la
-- lista → click de nuevo no debe romper). Quitar rechaza dejar el panel sin
-- ningún admin (raise exception — el panel lo muestra como error, no lo
-- intenta silenciar).
create or replace function public.admin_agregar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;
  insert into public.admins (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function public.admin_agregar(uuid) from public, anon;
grant execute on function public.admin_agregar(uuid) to authenticated;

create or replace function public.admin_quitar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'No se puede quitar al último administrador';
  end if;
  delete from public.admins where user_id = p_user_id;
end;
$$;

revoke execute on function public.admin_quitar(uuid) from public, anon;
grant execute on function public.admin_quitar(uuid) to authenticated;

-- ── Clientes: agregado desde pedidos (no hay tabla de perfil de cliente
-- propia todavía, ver SPEC-dashboard-admin.md sección 2). Último nombre/
-- teléfono/dirección NO nulos usados (un pedido puntual con algún campo
-- vacío no debe tapar el dato real de uno anterior), cantidad de pedidos y
-- fecha del último. Sin "total histórico": sumar con el precio ACTUAL
-- (catalogo_precios) contra pedidos viejos sería un número falso, no una
-- aproximación razonable — queda afuera a propósito.
create or replace function public.clientes_resumen()
returns table (
  user_id uuid,
  email text,
  nombre text,
  telefono text,
  direccion text,
  cantidad_pedidos bigint,
  ultimo_pedido timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.user_id,
    u.email,
    (array_agg(p.nombre order by p.created_at desc) filter (where nullif(btrim(p.nombre), '') is not null))[1] as nombre,
    (array_agg(p.telefono order by p.created_at desc) filter (where nullif(btrim(p.telefono), '') is not null))[1] as telefono,
    (array_agg(p.direccion order by p.created_at desc) filter (where nullif(btrim(p.direccion), '') is not null))[1] as direccion,
    count(*) as cantidad_pedidos,
    max(p.created_at) as ultimo_pedido
  from public.pedidos p
  join auth.users u on u.id = p.user_id
  where public.es_admin()
  group by p.user_id, u.email
  order by max(p.created_at) desc;
$$;

revoke execute on function public.clientes_resumen() from public, anon;
grant execute on function public.clientes_resumen() to authenticated;
