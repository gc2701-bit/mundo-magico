-- Catálogo 15 — catalogo_productos.talles se unifica en `variantes`
-- (SPEC-catalogo-admin-variantes.md, sección 3.1, diseñado por
-- brainstorming 2026-08-25). Hasta ahora `talles` sólo cubría un eje
-- (tradicionalmente "talle"), con {nombre, codigo}, sin imagen propia por
-- opción y sin forma de desactivar una opción puntual sin borrarla.
--
-- `variantes` es el mismo mecanismo generalizado: {talle?, tipo?, codigo,
-- imagen?, activo}. Soporta matriz talle×color (una fila por combinación
-- real que existe en Búho, nunca hace falta completar combinaciones que
-- no existen) y un on/off ("a la venta") por opción. La UI que arma/edita
-- filas de variantes y el selector talle×tipo de la ficha pública son
-- tandas aparte (Sprint 4/5 del plan) — esta migración sólo mueve el dato,
-- sin cambiar ningún comportamiento observable todavía.

alter table public.catalogo_productos rename column talles to variantes;

-- Transforma cada elemento existente {nombre, codigo} -> {talle, codigo,
-- activo: true} — todas las opciones ya cargadas siguen "a la venta" por
-- default, ninguna se desactiva sola con esta migración.
update public.catalogo_productos
set variantes = (
  select jsonb_agg(jsonb_build_object(
    'talle', elem->>'nombre',
    'codigo', elem->>'codigo',
    'activo', true
  ))
  from jsonb_array_elements(variantes) as elem
)
where variantes is not null and jsonb_array_length(variantes) > 0;

-- catalogo_publico(): mismo cuerpo que catalogo_13_publico_destacados.sql,
-- sólo cambia la clave 'talles' -> 'variantes' y la columna fuente.
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
                   'destacadoHome', destacado_home, 'precioOferta', precio_oferta
                 ) order by orden, titulo
               )
       from public.catalogo_productos where publicado), '[]'::jsonb)
  );
$$;

-- catalogo_listar(): mismo cuerpo que catalogo_14_listar_campos_completos.sql,
-- sólo cambia la clave 'talles' -> 'variantes' y la columna fuente.
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
           cp.precio, coalesce(cp.sin_stock, true) as sin_stock
    from public.catalogo_productos p
    left join public.catalogo_precios cp on cp.codigo = p.codigo
    where p.publicado
      and (p_mundo is null or p.mundo = p_mundo)
      and (p_familia is null or p.familia = p_familia)
      and (p_precio_min is null or cp.precio >= p_precio_min)
      and (p_precio_max is null or cp.precio <= p_precio_max)
      and (not p_solo_stock or (cp.codigo is not null and not coalesce(cp.sin_stock, false)))
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

-- catalogo_buscar(): mismo cuerpo que catalogo_14b_buscar_orden.sql (la
-- versión final, con `orden`), sólo cambia la clave 'talles' -> 'variantes'
-- y la columna fuente.
create or replace function public.catalogo_buscar(
  p_query        text,
  p_mundo        text default null,
  p_familia      text default null,
  p_cursor_score double precision default null,
  p_cursor_id    uuid default null,
  p_limite       integer default 10
)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
  with base as (
    select p.id, p.mundo, p.titulo, p.slug, p.codigo, p.familia, p.fotos,
           p.destacado_home, p.precio_oferta, cp.precio, p.orden,
           p.specs, p.descripcion, p.tags, p.variantes, p.subcategoria_id,
           (ts_rank(p.busqueda_tsv, plainto_tsquery('spanish', p_query))
            + similarity(p.titulo, p_query)) as score
    from public.catalogo_productos p
    left join public.catalogo_precios cp on cp.codigo = p.codigo
    where p.publicado
      and (p_mundo is null or p.mundo = p_mundo)
      and (p_familia is null or p.familia = p_familia)
      and (
        p.busqueda_tsv @@ plainto_tsquery('spanish', p_query)
        or p.titulo % p_query
      )
  ),
  candidatos as (
    select * from base
    where p_cursor_score is null
       or score < p_cursor_score
       or (score = p_cursor_score and id > p_cursor_id)
    order by score desc, id asc
    limit least(greatest(coalesce(p_limite, 10), 1), 40) + 1
  ),
  pagina as (
    select * from candidatos
    order by score desc, id asc
    limit least(greatest(coalesce(p_limite, 10), 1), 40)
  )
  select jsonb_build_object(
    'productos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'mundo', mundo, 'titulo', titulo, 'slug', slug, 'codigo', codigo,
        'familia', familia, 'fotos', fotos, 'destacadoHome', destacado_home,
        'precioOferta', precio_oferta, 'precio', precio, 'score', score,
        'orden', orden, 'specs', specs, 'descripcion', descripcion, 'tags', tags,
        'variantes', variantes, 'subcategoriaId', subcategoria_id
      ) order by score desc, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;
