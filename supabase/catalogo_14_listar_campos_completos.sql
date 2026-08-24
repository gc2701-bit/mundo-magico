-- Catálogo 14 — catalogo_listar()/catalogo_buscar() suman specs,
-- descripcion, tags, talles, subcategoriaId (Sprint 5 del rediseño de
-- frontend, ver docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
--
-- Encontrado armando la página de mundo: ProductoCard.tsx necesita esos
-- campos (specs para la lista de detalle, talles para el selector de
-- variantes de AccionesProducto.tsx) y catalogo_listar() no los traía —
-- sólo tenía lo mínimo para el listado simple del Sprint 1. Sin esto, un
-- producto con talles se rompía al pasar por el flujo de filtros (no
-- podía elegir talle, sólo agregaba el primero).
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
           p.specs, p.descripcion, p.tags, p.talles, p.subcategoria_id,
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
        'talles', talles, 'subcategoriaId', subcategoria_id
      ) order by orden, titulo, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;

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
           p.specs, p.descripcion, p.tags, p.talles, p.subcategoria_id,
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
        'talles', talles, 'subcategoriaId', subcategoria_id
      ) order by score desc, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;
