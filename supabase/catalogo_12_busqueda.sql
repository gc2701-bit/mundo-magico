-- Catálogo 12 — búsqueda y filtros server-side para el rediseño de
-- frontend (Sprint 1, ver
-- docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md y
-- la spec de diseño del mismo día). Correr DESPUÉS de
-- catalogo_10_publico_mundo.sql.
--
-- Por qué esto no vive en catalogo_publico(): esa función se descarga
-- completa en cada visita (ver el comentario de catalogo_05_buho_espejo.sql)
-- — funciona porque hoy son ~350 productos, pero deja de tener sentido
-- cuando la curación de contenido avance hacia el resto del espejo de
-- Búho (4.236 filas). catalogo_listar()/catalogo_buscar() reemplazan ese
-- patrón para cualquier lugar que filtre/busque (página de mundo,
-- Explorar, buscador predictivo): paginan por cursor (nunca OFFSET) y
-- nunca tocan catalogo_buho_espejo directamente — mismo criterio que
-- catalogo_publico(), sólo exponen catalogo_productos publicados.
--
-- Dos funciones, no una, a propósito: filtrar (mundo/familia/precio/
-- stock, sin texto libre) y buscar por texto ordenan por criterios
-- completamente distintos (orden manual vs. relevancia), mezclarlas en
-- una sola función con ramas exigiría SQL dinámico para poco beneficio
-- real. La "única capa server-side" que pide la spec para poder cambiar
-- de motor de búsqueda después vive en lib/busqueda.ts (TypeScript), que
-- envuelve a las dos.

-- ── Columnas nuevas para curar el hero desde el panel admin ─────────────
-- (el UI de esa curación no es parte de este sprint, sólo el dato)
alter table public.catalogo_productos
  add column if not exists destacado_home boolean not null default false,
  add column if not exists precio_oferta integer;

alter table public.catalogo_productos
  drop constraint if exists catalogo_productos_precio_oferta_check;
alter table public.catalogo_productos
  add constraint catalogo_productos_precio_oferta_check
  check (precio_oferta is null or precio_oferta > 0);

-- ── Halloween y Navidad como mundos nuevos (decisión de negocio: son las
-- temporadas de venta más fuertes, con productos casi únicos) ───────────
insert into public.catalogo_mundos (slug, nombre, orden) values
  ('halloween', 'Halloween', 8),
  ('navidad',   'Navidad',   9)
on conflict (slug) do nothing;

-- ── Texto completo: columna + trigger (NO "generated always as", to_tsvector
-- no es IMMUTABLE aunque se le pase el regconfig a mano — Postgres no
-- deja usarlo en una columna generada, hace falta trigger) ──────────────
alter table public.catalogo_productos
  add column if not exists busqueda_tsv tsvector;

create or replace function public.catalogo_productos_tsv_actualizar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.busqueda_tsv :=
    setweight(to_tsvector('spanish', coalesce(new.titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.descripcion, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.familia, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_catalogo_productos_tsv on public.catalogo_productos;
create trigger trg_catalogo_productos_tsv
  before insert or update of titulo, descripcion, tags, familia
  on public.catalogo_productos
  for each row execute function public.catalogo_productos_tsv_actualizar();

-- Backfill de lo que ya existe (el trigger sólo corre a futuro)
update public.catalogo_productos set busqueda_tsv =
  setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(familia, '')), 'C');

-- ── Índices ───────────────────────────────────────────────────────────
create index if not exists catalogo_productos_busqueda_tsv_idx
  on public.catalogo_productos using gin (busqueda_tsv);

-- pg_trgm ya está habilitada por catalogo_05_buho_espejo.sql — idempotente.
create extension if not exists pg_trgm;
create index if not exists catalogo_productos_titulo_trgm_idx
  on public.catalogo_productos using gin (titulo gin_trgm_ops);

create index if not exists catalogo_productos_familia_idx
  on public.catalogo_productos (familia);
create index if not exists catalogo_productos_publicado_mundo_orden_idx
  on public.catalogo_productos (mundo, orden, titulo, id)
  where publicado;

-- ── catalogo_listar(): filtrado sin texto libre, paginado por cursor ────
-- Usan esto la página de un mundo (/[mundo]) y Explorar (mundo como
-- filtro más, no segmento de URL — ver la spec). "solo_stock" se apoya en
-- catalogo_precios (por código) — un producto sin código (bug conocido,
-- ver el plan) queda excluido cuando se pide solo_stock=true, nunca se
-- afirma que tiene stock sin poder confirmarlo.
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
           -- Sin fila en catalogo_precios (sin código, o código no
           -- sincronizado todavía) = no se puede confirmar stock → se
           -- reporta sin_stock=true, nunca "false" sin evidencia real.
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
        'orden', orden
      ) order by orden, titulo, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;

revoke execute on function public.catalogo_listar(
  text, text, integer, integer, boolean, integer, text, uuid, integer
) from public;
grant execute on function public.catalogo_listar(
  text, text, integer, integer, boolean, integer, text, uuid, integer
) to anon, authenticated;

-- ── catalogo_buscar(): texto libre, orden por relevancia ─────────────────
-- Combina full-text (busqueda_tsv, con peso A=título/B=descripción+tags/
-- C=familia) y similitud de trigramas sobre el título (tolera errores de
-- tipeo) — usan esto el buscador predictivo del nav y "ver todos los
-- resultados". Nunca busca en catalogo_buho_espejo.
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
           p.destacado_home, p.precio_oferta, cp.precio,
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
        'precioOferta', precio_oferta, 'precio', precio, 'score', score
      ) order by score desc, id) from pagina), '[]'::jsonb),
    'hayMas', (select count(*) from candidatos) > (select count(*) from pagina)
  );
$$;

revoke execute on function public.catalogo_buscar(
  text, text, text, double precision, uuid, integer
) from public;
grant execute on function public.catalogo_buscar(
  text, text, text, double precision, uuid, integer
) to anon, authenticated;
