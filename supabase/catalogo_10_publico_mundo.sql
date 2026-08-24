-- Catálogo 10 — catalogo_productos.pagina pasa a llamarse `mundo` y sus
-- valores pierden el sufijo histórico "-v2.html" (Sprint 5.5, ver
-- catalogo_09_mundos.sql). Correr DESPUÉS de esa migración.
--
-- Los 379 productos existentes ya estaban clasificados en `pagina` desde
-- la migración de Sprint 1 (valores como 'globos-fiesta-v2.html') — el
-- backfill de abajo les saca el sufijo para que coincidan 1:1 con los
-- slugs de catalogo_mundos, sin ningún trabajo manual.
--
-- `ALTER TABLE ... RENAME COLUMN` conserva los GRANT de columna que ya
-- tenía `pagina` (catalogo_03_subcategorias.sql: INSERT/UPDATE para
-- authenticated, SELECT para anon/authenticated) — no hace falta
-- regrant acá.

alter table public.catalogo_productos rename column pagina to mundo;

update public.catalogo_productos
  set mundo = regexp_replace(mundo, '-v2\.html$', '')
  where mundo like '%-v2.html';

alter table public.catalogo_productos
  add constraint catalogo_productos_mundo_fkey foreign key (mundo) references public.catalogo_mundos(slug);

-- ── catalogo_publico(): productos exponen `mundo` en vez de `pagina` ─────
-- Reemplaza la función entera (create or replace) — mismo criterio que
-- cada archivo catalogo_NN que le suma un campo nuevo.
create or replace function public.catalogo_publico()
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'v', (select extract(epoch from greatest(
            coalesce((select max(actualizado_en) from public.catalogo_precios), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_fotos), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_tarjetas), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_subcategorias), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_productos), 'epoch'::timestamptz),
            coalesce((select actualizado_en from public.catalogo_config), 'epoch'::timestamptz)
          ))::bigint),
    'precios', coalesce(
      (select jsonb_object_agg(codigo, precio) from public.catalogo_precios), '{}'::jsonb),
    'sinStock', coalesce(
      (select jsonb_agg(codigo) from public.catalogo_precios where sin_stock), '[]'::jsonb),
    'pocasUnidades', coalesce(
      (select jsonb_agg(codigo) from public.catalogo_precios
       where not sin_stock
         and stock is not null
         and stock <= (select umbral_pocas_unidades from public.catalogo_config)), '[]'::jsonb),
    'fotos', coalesce(
      (select jsonb_object_agg(ruta, codigo) from public.catalogo_fotos), '{}'::jsonb),
    'tarjetas', coalesce(
      (select jsonb_object_agg(
                 pagina || '~' || slug,
                 jsonb_build_object(
                   'oculta', oculta,
                   'sinStock', sin_stock,
                   'precioFijo', precio_fijo,
                   'subcategoriaId', subcategoria_id,
                   'codigoOverride', codigo_override,
                   'coloresSinStock', coalesce(to_jsonb(colores_sin_stock), '[]'::jsonb)
                 )
               )
       from public.catalogo_tarjetas
       where oculta or sin_stock is not null or precio_fijo is not null
          or subcategoria_id is not null or codigo_override is not null
          or (colores_sin_stock is not null and array_length(colores_sin_stock, 1) > 0)), '{}'::jsonb),
    'subcategorias', coalesce(
      (select jsonb_object_agg(
                 id::text,
                 jsonb_build_object('pagina', pagina, 'nombre', nombre, 'slug', slug, 'orden', orden)
               )
       from public.catalogo_subcategorias), '{}'::jsonb),
    'mundos', coalesce(
      (select jsonb_agg(
                 jsonb_build_object('slug', slug, 'nombre', nombre, 'orden', orden)
                 order by orden
               )
       from public.catalogo_mundos), '[]'::jsonb),
    'productos', coalesce(
      (select jsonb_agg(
                 jsonb_build_object(
                   'id', id, 'mundo', mundo, 'subcategoriaId', subcategoria_id,
                   'titulo', titulo, 'slug', slug, 'codigo', codigo, 'specs', specs,
                   'descripcion', descripcion, 'tags', tags, 'talles', talles,
                   'fotos', fotos, 'orden', orden, 'familia', familia
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;
