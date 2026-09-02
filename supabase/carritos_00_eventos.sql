-- Carritos 00 — tracking de carritos abandonados/completados, para
-- /admin/carritos (Sprint E del dashboard admin, ver SPEC-dashboard-admin.md
-- y tasks/plan-dashboard-admin.md). Correr en el proyecto de catálogo/
-- pedidos (kyuilrlewynqrzebouww), DESPUÉS de envios_00_base.sql (necesita
-- public.es_admin()).
--
-- Primer archivo con prefijo `carritos_` — dominio nuevo. El carrito en sí
-- sigue viviendo 100% en localStorage del browser (lib/carrito.ts,
-- `mm_carrito_v2`) — esta tabla NO lo reemplaza, sólo registra eventos de
-- actividad para poder medir abandono, y SÓLO para usuarios logueados
-- (decisión explícita del usuario: un carrito anónimo genera demasiado
-- ruido para ser una señal útil).
create table if not exists public.carrito_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('agregado', 'quitado', 'checkout_iniciado')),
  codigo text,
  titulo text not null,
  variante text,
  cantidad int,
  created_at timestamptz not null default now()
);

alter table public.carrito_eventos enable row level security;

-- Un usuario logueado inserta sus propios eventos directo (no es una
-- acción privilegiada, a diferencia de admins/clientes en
-- usuarios_00_admin_clientes.sql) — RLS de INSERT alcanza, sin RPC.
create policy "Un usuario inserta sus propios eventos de carrito"
  on public.carrito_eventos for insert
  with check (auth.uid() = user_id);

create policy "Los admins leen todos los eventos de carrito"
  on public.carrito_eventos for select
  using (public.es_admin());

create index if not exists carrito_eventos_user_id_idx
  on public.carrito_eventos (user_id, created_at desc);

-- ── carritos_admin(): un renglón por usuario con actividad de carrito ────
-- "completado" = existe un pedido de ese usuario con created_at >= el
-- último evento de su carrito (ver el límite conocido documentado en
-- lib/carritos-admin.ts). Los "últimos ítems" son sólo los últimos 5
-- eventos crudos (no una vista deduplicada por producto) — alcanza para
-- mostrar "qué estaba mirando" sin una consulta más compleja.
create or replace function public.carritos_admin()
returns table (
  user_id uuid,
  email text,
  ultimo_evento timestamptz,
  completado boolean,
  ultimos_items jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ultimo as (
    select ce.user_id, max(ce.created_at) as ultimo_evento
    from public.carrito_eventos ce
    group by ce.user_id
  )
  select
    u.user_id,
    au.email,
    u.ultimo_evento,
    exists (
      select 1 from public.pedidos p
      where p.user_id = u.user_id and p.created_at >= u.ultimo_evento
    ) as completado,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', ce.tipo, 'titulo', ce.titulo, 'variante', ce.variante, 'cantidad', ce.cantidad
             ) order by ce.created_at desc)
      from (
        select * from public.carrito_eventos ce2
        where ce2.user_id = u.user_id
        order by ce2.created_at desc
        limit 5
      ) ce
    ), '[]'::jsonb) as ultimos_items
  from ultimo u
  join auth.users au on au.id = u.user_id
  where public.es_admin()
  order by u.ultimo_evento desc;
$$;

revoke execute on function public.carritos_admin() from public, anon;
grant execute on function public.carritos_admin() to authenticated;
