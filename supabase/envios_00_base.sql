-- E0 — Cimientos y arreglos de producción.
-- Correr una sola vez en el SQL Editor del proyecto Supabase de pedidos
-- (https://kyuilrlewynqrzebouww.supabase.co → SQL Editor → New query),
-- DESPUÉS de pedidos.sql y pedidos_envio.sql.
--
-- Arregla tres problemas encontrados en la auditoría antes de construir el
-- sistema de logística encima:
--   1. La política de UPDATE de admin no tenía WITH CHECK: sin él, ni
--      siquiera hacía falta pasar por `es_admin()` para el chequeo de
--      escritura. Ojo: esto NO limita qué columnas puede tocar un admin —
--      RLS filtra filas, no columnas. Esa restricción por columna se agrega
--      recién en envios_11_admin_columnas.sql, con GRANT/REVOKE.
--   2. metodo_entrega se agregó como `not null default 'retiro'`, así que
--      todos los pedidos viejos (incluidos los que eran envíos) quedaron
--      marcados como retiro. cuenta.js:668 ya sabe mostrar el texto libre
--      original (`p.entrega`) cuando metodo_entrega es null — sólo hacía
--      falta liberar la columna y anular esas filas.
--   3. No había ningún índice en `pedidos`.

-- ── Zona horaria ─────────────────────────────────────────────────────────
-- now() es UTC. Después de las 21h en Tucumán, "hoy" en UTC ya es "mañana"
-- allá. Toda comparación de fechas de entrega tiene que pasar por acá.
create or replace function public.hoy_ar()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Tucuman')::date;
$$;

grant execute on function public.hoy_ar() to anon, authenticated;

-- ── Admin, en un solo lugar ──────────────────────────────────────────────
-- security definer: puede leer public.admins aunque el que llama no tenga
-- (y no necesita) permiso de SELECT sobre esa tabla.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

-- ── Políticas de admin: agregar WITH CHECK ──────────────────────────────
drop policy if exists "Los admins ven todos los pedidos" on public.pedidos;
drop policy if exists "Los admins actualizan el estado de cualquier pedido" on public.pedidos;

create policy "Los admins ven todos los pedidos"
  on public.pedidos for select
  using (public.es_admin());

create policy "Los admins actualizan cualquier pedido"
  on public.pedidos for update
  using (public.es_admin())
  with check (public.es_admin());

-- ── Índices ──────────────────────────────────────────────────────────────
create index if not exists pedidos_fecha_entrega_idx on public.pedidos (fecha_entrega);
create index if not exists pedidos_estado_idx on public.pedidos (estado);
create index if not exists pedidos_user_id_idx on public.pedidos (user_id);
create index if not exists pedidos_created_at_idx on public.pedidos (created_at desc);

-- ── metodo_entrega: liberar los pedidos viejos ──────────────────────────
-- PASO 1 — correr esto primero y mirar el número antes de seguir:
--
--   select count(*) from public.pedidos
--   where entrega is not null and zona is null and direccion is null;
--
-- Esas son las filas de antes de pedidos_envio.sql: sólo tienen el texto
-- libre `entrega`, ninguno de los campos estructurados de envío. Si el
-- número es chico (esperable: son todos los pedidos previos a esta
-- migración), seguir con el paso 2. Si es sospechosamente grande, parar y
-- revisar antes de tocar nada.
--
-- PASO 2 — recién después de mirar el conteo de arriba:
--
--   alter table public.pedidos alter column metodo_entrega drop not null;
--
--   update public.pedidos set metodo_entrega = null
--   where entrega is not null and zona is null and direccion is null;
--
-- Con metodo_entrega en null, cuenta.js:668 vuelve a mostrar el texto
-- original de `entrega` para esos pedidos en vez de "Retiro en el local".
