-- E13 — Borrar mi cuenta (Ajustes → Datos).
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql … envios_12_limites_abuso.sql.
--
-- Un cliente no tiene permiso para borrar filas de auth.users directamente
-- (ni debería tenerlo: podría intentar borrar cualquier id, no sólo el
-- propio). eliminar_mi_cuenta() es security definer: corre con privilegios
-- de superusuario, pero adentro sólo borra `auth.uid()` — la cuenta del que
-- llama, nunca otra.
--
-- OJO con el historial de pedidos: `pedidos.user_id` tenía
-- `on delete cascade`, así que borrar la cuenta borraba también TODOS sus
-- pedidos (el negocio pierde ese historial de ventas/contabilidad). Este
-- archivo lo cambia a `on delete set null`: la cuenta desaparece, pero el
-- pedido y sus datos (items, fecha, dirección) se conservan en
-- admin-pedidos.html con user_id en null, igual que ya se conservan los
-- pedidos de antes de que existieran las cuentas.

alter table public.pedidos alter column user_id drop not null;

-- Si esto falla con "constraint does not exist", buscar el nombre real con:
--   select conname from pg_constraint where conrelid = 'public.pedidos'::regclass and contype = 'f';
alter table public.pedidos drop constraint pedidos_user_id_fkey;
alter table public.pedidos add constraint pedidos_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
