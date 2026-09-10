-- Catálogo 22 — selector de "vidriera" por producto (pedido explícito del
-- usuario, 2026-09-10): hasta ahora la vidriera de cada mundo en el home
-- (Vidriera.tsx) mostraba automáticamente los primeros 8 productos
-- publicados de ese mundo (`orden asc, titulo asc`, mismo orden que ya usa
-- catalogo_publico()) — sin curación real. El usuario quiere elegir a mano
-- qué productos aparecen ahí, con el mismo tipo de selector (Switch) que ya
-- existe para `destacado_home` (el carrusel de destacados).
--
-- `en_vidriera` default false: un producto nuevo no aparece solo en ninguna
-- vidriera, el admin lo prende cuando quiere (mismo criterio que
-- destacado_home). El backfill de abajo es la excepción — existe sólo para
-- no vaciar las vidrieras que HOY tienen productos reales en producción.
alter table public.catalogo_productos
  add column en_vidriera boolean not null default false;

-- GRANT por columna (mismo patrón que catalogo_18_grant_familia_destacado.sql
-- — los privilegios de columna no son retroactivos, hace falta uno explícito
-- por columna nueva o el admin se queda sin poder tocarla desde el panel).
grant update (en_vidriera) on public.catalogo_productos to authenticated;
grant insert (en_vidriera) on public.catalogo_productos to authenticated;

-- Backfill: marca en_vidriera = true en los primeros 8 productos publicados
-- de cada uno de los 5 mundos que HOY tienen sección de vidriera en el home
-- (VIDRIERAS en app/page.tsx), en el mismo orden que ya arma Vidriera.tsx
-- (`productos.filter(mundo).slice(0, 8)`, sobre el orden de
-- catalogo_publico(): `orden asc, titulo asc`). Así la vidriera queda
-- exactamente como se ve hoy en producción — el admin recién de acá en más
-- puede cambiar cuáles son. Navidad no tiene productos publicados todavía
-- (sigue con su teaser propio), así que no suma filas acá.
with candidatos as (
  select id, mundo,
         row_number() over (partition by mundo order by orden asc, titulo asc) as posicion
  from public.catalogo_productos
  where publicado
    and mundo in ('cumpleanos', 'globos-fiesta', 'decoracion', 'halloween', 'navidad')
)
update public.catalogo_productos p
set en_vidriera = true
from candidatos c
where p.id = c.id and c.posicion <= 8;

-- catalogo_publico(): mismo cuerpo que catalogo_15_variantes.sql, sólo suma
-- 'enVidriera' al jsonb de cada producto.
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
                   'descripcion', descripcion, 'tags', tags, 'variantes', variantes,
                   'fotos', fotos, 'orden', orden, 'familia', familia,
                   'destacadoHome', destacado_home, 'precioOferta', precio_oferta,
                   'enVidriera', en_vidriera
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;
