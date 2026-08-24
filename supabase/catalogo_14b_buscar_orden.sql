-- Catálogo 14b — catalogo_buscar() también devuelve `orden` (Sprint 5 del
-- rediseño de frontend, ver
-- docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
--
-- Follow-up del mismo día que catalogo_14: ese migration le sumó specs/
-- descripcion/tags/talles/subcategoriaId a las dos RPCs, pero `orden` se
-- quedó afuera de catalogo_buscar() por error de copiado (catalogo_listar()
-- sí lo tenía, necesario para paginar por cursor cuando ProductoListado/
-- ProductoBuscado comparten el mismo tipo base en lib/busqueda.ts).
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
