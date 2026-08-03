-- Datos estructurados de entrega + panel de administración de pedidos.
-- Correr una sola vez en el SQL Editor del proyecto Supabase, DESPUÉS de
-- haber corrido pedidos.sql (https://kyuilrlewynqrzebouww.supabase.co →
-- SQL Editor → New query).
--
-- Agrega a `pedidos` los campos que hacían falta para poder agrupar los
-- pedidos por fecha de entrega, retiro/envío, zona y estado. La columna
-- vieja `entrega` (texto libre) se deja como está, para no romper pedidos
-- ya guardados; los pedidos nuevos usan los campos de acá.

alter table public.pedidos
  add column if not exists metodo_entrega text not null default 'retiro'
    check (metodo_entrega in ('retiro', 'envio')),
  add column if not exists fecha_entrega date,
  add column if not exists direccion text,
  add column if not exists zona text,
  add column if not exists telefono text,
  add column if not exists estado text not null default 'nuevo'
    check (estado in ('nuevo', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'));

-- Cuentas del negocio que pueden ver y organizar TODOS los pedidos (no solo
-- los propios). Se completa a mano: después de crear la cuenta del negocio
-- desde el sitio como cualquier cliente, se inserta su user_id acá (se
-- consigue en Supabase → Authentication → Users).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create policy "Un admin se ve a si mismo"
  on public.admins for select
  using (auth.uid() = user_id);

create policy "Los admins ven todos los pedidos"
  on public.pedidos for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "Los admins actualizan el estado de cualquier pedido"
  on public.pedidos for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Ejemplo para dar de alta a la cuenta del negocio como admin (reemplazar el
-- uuid por el de Authentication → Users → esa cuenta → User UID):
-- insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000000');
