-- Catálogo 23 — un código con stock real <= 0 (el que sincroniza el
-- worker de Búho, ver buho-stock-sync-worker) ahora cuenta como "sin
-- stock" aunque nadie haya tildado el flag manual `sin_stock` desde el
-- panel admin.
--
-- Bug real reportado por el usuario (2026-09-10): productos con stock 0
-- en catalogo_precios.stock (numérico, lo llena el worker) mostraban
-- "Quedan pocas unidades" en vez de "Sin stock" en la web. Causa raíz:
-- catalogo_publico()/catalogo_listar() calculaban "sin stock"
-- ÚNICAMENTE a partir del flag manual `catalogo_precios.sin_stock`
-- (boolean, default false, lo tilda un humano desde el panel) — nunca
-- miraban el número real de `stock`. Como nadie tildó el flag a mano
-- para esos códigos, `sin_stock=false` + `stock<=umbral` los mandaba
-- derecho al bucket de "pocas unidades" en vez de "sin stock".
--
-- Fix: "sin stock" ahora es `sin_stock OR stock<=0` (OR, no reemplazo) —
-- el flag manual sigue funcionando igual que antes para forzar "sin
-- stock" en un código con stock real positivo (ej. reservado, no se
-- quiere vender aunque haya unidades), y ahora ADEMÁS un stock real 0 o
-- negativo alcanza por sí solo, sin depender de que un humano lo marque.
-- "Pocas unidades" excluye explícitamente stock<=0 (antes sólo excluía
-- sin_stock=true), para no pisarse con el nuevo caso.
--
-- Mismo cuerpo que catalogo_15_variantes.sql para ambas funciones, sólo
-- cambia el cálculo de sin_stock/pocasUnidades — nada de variantes ni del
-- resto del contrato se toca.

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
                   'destacadoHome', destacado_home, 'precioOferta', precio_oferta
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;

create or replace function public.catalogo_listar(
  p_mundo         text default null,
  p_familia       text default null,
  p_precio_min    integer default null,
  p_precio_max    integer default null,
  p_solo_stock    boolean default false,
  p_cursor_orden  integer default null,
  p_cursor_titulo text default null,
  p_cursor_id     uuid default null,
  p_limite        integer default 24
)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
  with candidatos as (
    select p.id, p.mundo, p.titulo, p.slug, p.codigo, p.familia, p.fotos,
           p.destacado_home, p.precio_oferta, p.orden,
           p.specs, p.descripcion, p.tags, p.variantes, p.subcategoria_id,
           cp.precio,
           case
             when cp.codigo is null then true
             else coalesce(cp.sin_stock, false) or (cp.stock is not null and cp.stock <= 0)
           end as sin_stock
    from public.catalogo_productos p
    left join public.catalogo_precios cp on cp.codigo = p.codigo
    where p.publicado
      and (p_mundo is null or p.mundo = p_mundo)
      and (p_familia is null or p.familia = p_familia)
      and (p_precio_min is null or cp.precio >= p_precio_min)
      and (p_precio_max is null or cp.precio <= p_precio_max)
      and (not p_solo_stock or (
        cp.codigo is not null
        and not coalesce(cp.sin_stock, false)
        and not (cp.stock is not null and cp.stock <= 0)
      ))
      and (
        p_cursor_orden is null
        or p.orden > p_cursor_orden
        or (p.orden = p_cursor_orden and p.titulo > p_cursor_titulo)
        or (p.orden = p_cursor_orden and p.titulo = p_cursor_titulo and p.id > p_cursor_id)
      )
    order by p.orden asc, p.titulo asc, p.id asc
    limit least(greatest(coalesce(p_limite, 24), 1), 60) + 1
  ),
  pagina as (
    select * from candidatos
    order by orden asc, titulo asc, id asc
    limit least(greatest(coalesce(p_limite, 24), 1), 60)
  )
  select jsonb_build_object(
    'productos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'mundo', mundo, 'titulo', titulo, 'slug', slug, 'codigo', codigo,
        'familia', familia, 'fotos', fotos, 'destacadoHome', destacado_home,
        'precioOferta', precio_oferta, 'precio', precio, 'sinStock', sin_stock,
        'orden', orden, 'specs', specs, 'descripcion', descripcion, 'tags', tags,
        'variantes', variantes, 'subcategoriaId', subcategoria_id
      ) order by orden, titulo, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;
