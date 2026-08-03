-- Historial de pedidos (Perfil → Mis pedidos).
-- Correr una sola vez en el SQL Editor del proyecto Supabase
-- (https://kyuilrlewynqrzebouww.supabase.co → SQL Editor → New query).
--
-- Cada pedido enviado por WhatsApp desde la web queda guardado acá también,
-- así el cliente puede verlo de nuevo desde su cuenta. RLS asegura que cada
-- usuario sólo puede ver/crear sus propios pedidos.

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  nombre text,
  entrega text,
  nota text,
  created_at timestamptz not null default now()
);

alter table public.pedidos enable row level security;

create policy "Los usuarios ven sus propios pedidos"
  on public.pedidos for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propios pedidos"
  on public.pedidos for insert
  with check (auth.uid() = user_id);
