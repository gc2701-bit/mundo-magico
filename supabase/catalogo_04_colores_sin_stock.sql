-- Catálogo 04 — Sin stock POR COLOR en una galería que comparte un solo
-- código del POS.
-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_00_base.sql.
--
-- Por qué hace falta una columna nueva y no alcanza con catalogo_precios:
-- "Mismo producto, mismo código, distintos colores" (ver CLAUDE.md) es
-- exactamente eso — UN código para todos los colores. sin_stock en
-- catalogo_precios es por código, así que marcarlo apaga TODOS los colores
-- a la vez. No hay forma de decir "no queda amarillo pero sí las demás" con
-- lo que ya existe, porque el POS ni siquiera distingue el amarillo del
-- resto: son el mismo artículo.
--
-- La solución es la misma idea que codigo_override (catalogo_03): un dato
-- que vive en LA TARJETA, no en el código. colores_sin_stock guarda los
-- nombres tal cual están en data-cap de cada <img> de la galería (el mismo
-- texto que ya se usa como "cap" en la ficha) — comparación por texto, no
-- por código, porque acá no hay ningún código que los distinga.
alter table public.catalogo_tarjetas
  add column if not exists colores_sin_stock text[];

-- Sube al mismo GRANT aditivo de catalogo_03_subcategorias.sql.
grant insert (colores_sin_stock) on public.catalogo_tarjetas to authenticated;
grant update (colores_sin_stock) on public.catalogo_tarjetas to authenticated;

-- catalogo_publico(): mismo patrón que subcategoriaId/codigoOverride —
-- reemplaza la función entera (create or replace) sumando el campo nuevo.
create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'v', (select extract(epoch from greatest(
            coalesce((select max(actualizado_en) from public.catalogo_precios), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_fotos), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_tarjetas), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_subcategorias), 'epoch'::timestamptz),
            coalesce((select max(actualizado_en) from public.catalogo_productos), 'epoch'::timestamptz)
          ))::bigint),
    'precios', coalesce(
      (select jsonb_object_agg(codigo, precio) from public.catalogo_precios), '{}'::jsonb),
    'sinStock', coalesce(
      (select jsonb_agg(codigo) from public.catalogo_precios where sin_stock), '[]'::jsonb),
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
    'productos', coalesce(
      (select jsonb_agg(
                 jsonb_build_object(
                   'id', id, 'pagina', pagina, 'subcategoriaId', subcategoria_id,
                   'titulo', titulo, 'slug', slug, 'codigo', codigo, 'specs', specs,
                   'descripcion', descripcion, 'tags', tags, 'talles', talles,
                   'fotos', fotos, 'orden', orden
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;

revoke execute on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated;
