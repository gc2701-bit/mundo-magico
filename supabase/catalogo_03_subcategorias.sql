-- Catálogo 03 — Subcategorías dentro de cada mundo, código editable a mano
-- y productos nuevos cargados desde la web (Fase 2).
-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_00_base.sql y
-- catalogo_02_storage.sql.
--
-- Tres cosas nuevas:
--   - catalogo_subcategorias: las secciones de una página (hoy escritas a
--     mano como <section class="catsec"><h2>Cortinas</h2>…) pasan a poder
--     crearse desde el navegador. Cada subcategoría es de UN solo mundo —
--     mismo criterio que las <section> actuales, que nunca se comparten
--     entre páginas.
--   - catalogo_tarjetas.codigo_override: corrige el código que resuelve una
--     tarjeta ya escrita en el HTML, sin tocar el HTML. Es distinto de
--     catalogo_precios.codigo (que sigue sin poder actualizarse, ver el
--     comentario de catalogo_00_base.sql): este override no toca ninguna
--     fila de precio, sólo le dice a ESTA tarjeta puntual a qué código
--     mirar primero.
--   - catalogo_tarjetas.subcategoria_id: a qué subcategoría se mudó una
--     tarjeta (null = se queda en la <section> del HTML donde nació).
--   - catalogo_productos: productos que no nacieron en el HTML, cargados
--     enteros desde la web (título, foto, código, precio). Acá "mover de
--     mundo" es sólo cambiar la columna `pagina` — no hay ningún HTML
--     físico del que despegarlos.
--
-- Mover una tarjeta HEREDADA (la que ya está en el HTML) a OTRO mundo no
-- tiene un mecanismo propio: se resuelve convirtiéndola en una fila de
-- catalogo_productos en el mundo destino y ocultando la original
-- (catalogo_tarjetas.oculta = true). Ver el comentario largo sobre esto en
-- el plan del catálogo — decisión tomada a propósito para no terminar con
-- dos formas de armar el DOM de una tarjeta en paralelo.

-- ── Subcategorías ────────────────────────────────────────────────────────
create table if not exists public.catalogo_subcategorias (
  id              uuid primary key default gen_random_uuid(),
  pagina          text not null,
  nombre          text not null,
  slug            text not null,
  orden           integer not null default 0,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users,
  constraint catalogo_subcategorias_slug_por_pagina unique (pagina, slug)
);

alter table public.catalogo_tarjetas
  add column if not exists subcategoria_id uuid references public.catalogo_subcategorias(id) on delete set null,
  add column if not exists codigo_override text;

-- ── Productos cargados desde la web (Fase 2) ─────────────────────────────
create table if not exists public.catalogo_productos (
  id              uuid primary key default gen_random_uuid(),
  pagina          text not null,
  subcategoria_id uuid references public.catalogo_subcategorias(id) on delete set null,
  titulo          text not null,
  slug            text not null,
  codigo          text,
  specs           text[],
  descripcion     text,
  tags            text[],
  talles          jsonb,
  fotos           jsonb not null default '[]'::jsonb,
  orden           integer not null default 0,
  publicado       boolean not null default true,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users,
  constraint catalogo_productos_slug_por_pagina unique (pagina, slug)
);

drop trigger if exists catalogo_subcategorias_sello on public.catalogo_subcategorias;
drop trigger if exists catalogo_productos_sello     on public.catalogo_productos;

create trigger catalogo_subcategorias_sello
  before insert or update on public.catalogo_subcategorias
  for each row execute function public.catalogo_sello();

create trigger catalogo_productos_sello
  before insert or update on public.catalogo_productos
  for each row execute function public.catalogo_sello();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.catalogo_subcategorias enable row level security;
alter table public.catalogo_productos     enable row level security;

create policy "Lectura pública de subcategorías" on public.catalogo_subcategorias for select using (true);
create policy "Admin escribe subcategorías"      on public.catalogo_subcategorias for all
  using (public.es_admin()) with check (public.es_admin());

-- Un producto no publicado es un borrador: sólo lo ve un admin (la segunda
-- política, "for all", ya cubre select para ese caso).
create policy "Lectura pública de productos publicados" on public.catalogo_productos for select using (publicado);
create policy "Admin gestiona productos"                on public.catalogo_productos for all
  using (public.es_admin()) with check (public.es_admin());

-- ── GRANT/REVOKE de columna ──────────────────────────────────────────────
-- La subcategoría no cambia de mundo una vez creada (eso movería de golpe
-- todo lo que tenga puesto): admin puede renombrarla y reordenarla, no
-- reasignarle `pagina`. Para llevar productos a otro mundo, `pagina` se
-- actualiza en catalogo_productos, o en catalogo_subcategorias se crea una
-- nueva en el mundo destino.
revoke insert, update, delete on public.catalogo_subcategorias from anon, authenticated;
grant insert (pagina, nombre, slug, orden) on public.catalogo_subcategorias to authenticated;
grant update (nombre, orden)               on public.catalogo_subcategorias to authenticated;
grant delete                               on public.catalogo_subcategorias to authenticated;

-- Columnas nuevas de catalogo_tarjetas: se suman al GRANT que ya existía en
-- catalogo_00_base.sql (los privilegios de columna son aditivos, esto no
-- pisa oculta/sin_stock/precio_fijo/nota).
grant insert (subcategoria_id, codigo_override) on public.catalogo_tarjetas to authenticated;
grant update (subcategoria_id, codigo_override) on public.catalogo_tarjetas to authenticated;

-- catalogo_productos es de la web de punta a punta (no viene del HTML): acá
-- sí se puede actualizar `pagina` — es literalmente la acción "mover a otro
-- mundo" para un producto que ya está convertido. Nunca hay DELETE de precio
-- a mitad de camino, así que tampoco hace falta separar `codigo` del resto.
revoke insert, update, delete on public.catalogo_productos from anon, authenticated;
grant insert (pagina, subcategoria_id, titulo, slug, codigo, specs, descripcion, tags, talles, fotos, orden, publicado)
  on public.catalogo_productos to authenticated;
grant update (pagina, subcategoria_id, titulo, slug, codigo, specs, descripcion, tags, talles, fotos, orden, publicado)
  on public.catalogo_productos to authenticated;
grant delete on public.catalogo_productos to authenticated;

-- ── catalogo_publico(): sumar los tres al único viaje de lectura ────────
-- Reemplaza la función de catalogo_00_base.sql entera (create or replace),
-- agregando subcategorias/productos y los dos campos nuevos de tarjetas.
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
                   'codigoOverride', codigo_override
                 )
               )
       from public.catalogo_tarjetas
       where oculta or sin_stock is not null or precio_fijo is not null
          or subcategoria_id is not null or codigo_override is not null), '{}'::jsonb),
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
