-- Catálogo 11 — compatibilidad de catalogo_publico() con el sitio Eleventy
-- viejo mientras conviva con el nuevo de Next.js. Correr DESPUÉS de
-- catalogo_10_publico_mundo.sql.
--
-- catalogo_10 le sacó la clave "pagina" a cada producto de la respuesta
-- de catalogo_publico() (pasó a "mundo", sin el sufijo "-v2.html"). El
-- problema: el sitio Eleventy viejo (`assets/catalogo-productos.js`) sigue
-- deployado en producción real HOY, comparte esta misma base de Supabase
-- con la branch de la migración, y espera literalmente esa clave con el
-- sufijo para poder pintar los productos de catalogo_productos en sus 7
-- páginas de categoría — sin esto, esos productos dejan de aparecer en
-- producción apenas se corre esta migración, aunque el código del sitio
-- viejo no cambie ni un byte.
--
-- Este shim reconstruye "pagina" a partir de "mundo" (mundo || '-v2.html'
-- es exactamente el valor histórico, ver catalogo_10) sin tocar el sitio
-- Eleventy viejo. Se retira junto con esa función en Sprint 7 (Task 7.2b
-- del plan) cuando el sitio Eleventy se borre del repo — buscar este
-- comentario si se olvida.
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
                   'id', id, 'mundo', mundo, 'pagina', mundo || '-v2.html', 'subcategoriaId', subcategoria_id,
                   'titulo', titulo, 'slug', slug, 'codigo', codigo, 'specs', specs,
                   'descripcion', descripcion, 'tags', tags, 'talles', talles,
                   'fotos', fotos, 'orden', orden, 'familia', familia
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;
