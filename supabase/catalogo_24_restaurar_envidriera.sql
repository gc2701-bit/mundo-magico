-- Catálogo 24 — restaura `enVidriera` en catalogo_publico(), pisado sin
-- querer por catalogo_23_agotado_por_stock.sql.
--
-- Causa raíz (2026-09-10/11): catalogo_22_en_vidriera.sql (22:31) sumó la
-- columna `en_vidriera` y el campo `'enVidriera', en_vidriera` al
-- `jsonb_build_object` de productos de catalogo_publico(). Una hora
-- después (23:31), catalogo_23_agotado_por_stock.sql se corrió en
-- producción vía SQL Editor — pero ese archivo se había escrito ANTES de
-- traer los commits que agregaron `en_vidriera` (de ahí la colisión de
-- numeración que forzó renombrarlo de catalogo_21 a catalogo_23, ver
-- commit 53fb2ef). Su versión de catalogo_publico() parte de la base
-- vieja (catalogo_15_variantes.sql), sin `enVidriera`. Como es
-- `CREATE OR REPLACE FUNCTION`, Postgres reemplaza el cuerpo entero de la
-- función, no lo fusiona — así que correr ese SQL en el editor pisó la
-- versión con `enVidriera` por una sin ese campo, en silencio (el fix de
-- stock funcionó perfecto, no saltó ninguna alarma).
--
-- Síntoma: el home (Vidriera.tsx, `productos.filter(p => p.mundo ===
-- mundoSlug && p.enVidriera)`) usa catalogo_publico() vía
-- lib/catalogo-server.ts — con `enVidriera` ausente del JSON, todo
-- producto llega con `enVidriera: undefined` y ninguna vidriera muestra
-- nada. El panel admin (PublicadoTab.tsx) no se ve afectado porque lee
-- `en_vidriera` con un `.select()` directo a la tabla, no por este RPC —
-- por eso el toggle de ProductoEditModal seguía mostrando el valor real
-- de la columna mientras el home ya no lo veía.
--
-- Fix: mismo cuerpo que catalogo_23_agotado_por_stock.sql (el OR de
-- stock<=0 para sin_stock/pocasUnidades queda igual, no se toca) más
-- `'enVidriera', en_vidriera` de vuelta en el jsonb de productos. No se
-- redefine catalogo_listar() acá porque nunca tuvo `enVidriera` en su
-- contrato (no lo necesita — no se usa fuera del home) y no fue tocado
-- por este pisado.
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
      (select jsonb_agg(codigo) from public.catalogo_precios
       where sin_stock or (stock is not null and stock <= 0)), '[]'::jsonb),
    'pocasUnidades', coalesce(
      (select jsonb_agg(codigo) from public.catalogo_precios
       where not sin_stock
         and stock is not null
         and stock > 0
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
                   'descripcion', descripcion, 'tags', tags, 'variantes', variantes,
                   'fotos', fotos, 'orden', orden, 'familia', familia,
                   'destacadoHome', destacado_home, 'precioOferta', precio_oferta,
                   'enVidriera', en_vidriera
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;
