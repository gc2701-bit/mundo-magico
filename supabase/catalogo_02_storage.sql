-- Catálogo 02 — Bucket de fotos para productos cargados desde la web.
-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_00_base.sql.
--
-- No lo usa nada todavía: assets/precios.js y admin-catalogo.js (Fase 1)
-- no suben fotos, sólo precio/stock/ocultar de tarjetas que ya existen en
-- el HTML. Este bucket es para la Fase 2 (alta de productos nuevos), pero
-- se deja creado ahora para no tener que volver al SQL Editor después.
--
-- Público de lectura (las fotos de un catálogo son para mostrarlas) y
-- sólo admin puede subir/borrar — mismo `public.es_admin()` que el resto
-- del proyecto.
insert into storage.buckets (id, name, public)
values ('catalogo', 'catalogo', true)
on conflict (id) do nothing;

drop policy if exists "Público lee fotos del catálogo" on storage.objects;
drop policy if exists "Admin sube fotos del catálogo" on storage.objects;
drop policy if exists "Admin borra fotos del catálogo" on storage.objects;

create policy "Público lee fotos del catálogo"
  on storage.objects for select
  using (bucket_id = 'catalogo');

create policy "Admin sube fotos del catálogo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'catalogo' and public.es_admin());

create policy "Admin borra fotos del catálogo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'catalogo' and public.es_admin());
