-- Catálogo 08 — El número real de stock deja de ser público.
-- Correr DESPUÉS de catalogo_07_stock_precios.sql.
--
-- EL PROBLEMA QUE ARREGLA ESTE ARCHIVO
-- catalogo_07 agregó `catalogo_precios.stock`, y catalogo_publico() tiene
-- mucho cuidado de no devolver nunca el número — sólo el array de códigos
-- `pocasUnidades`. Pero catalogo_00_base.sql dejó
-- `create policy "Lectura pública de precios" ... for select using (true)`
-- sin ningún GRANT de columna que lo acote: RLS filtra FILAS, no COLUMNAS.
-- Con eso, cualquiera con la anon key (que es pública por diseño) podía
-- pedir el número exacto a PostgREST sin pasar por la función:
--
--   GET /rest/v1/catalogo_precios?select=codigo,stock
--
-- Eso es exactamente lo que SPEC-catalogo-admin.md marca como la única regla
-- absoluta ("Nunca exponer el número real de stock al público"): cuántas
-- unidades tiene el local de cada artículo es información de negocio, no
-- catálogo. Se arregla con GRANT de columna, igual que
-- envios_11_admin_columnas.sql y que los grants de escritura de
-- catalogo_00_base.sql.

-- ── SELECT por columna: todo menos `stock` ───────────────────────────────
-- El revoke es a `anon` Y a `authenticated`: un cliente logueado no es más
-- confiable que un anónimo para esto (cualquiera se hace una cuenta). Los
-- GRANT son por ROL, no por fila, así que esto también le saca la columna a
-- la sesión de un admin — para eso está catalogo_precios_admin() más abajo.
-- service_role (el worker de Búho) no se toca: bypasea todo esto.
revoke select on public.catalogo_precios from anon, authenticated;
grant select (codigo, precio, sin_stock, nombre_pos, actualizado_en, actualizado_por)
  on public.catalogo_precios to anon, authenticated;

-- ── catalogo_publico() pasa a security definer ───────────────────────────
-- Ahora que anon/authenticated no tienen la columna, la función que corre
-- con los privilegios de QUIEN LLAMA tampoco la tendría, y `pocasUnidades`
-- se rompería para todo el sitio. Pasa a `security definer` para poder leer
-- `stock` internamente y seguir devolviendo SÓLO el array de códigos: el
-- número nunca sale de la función. Ya tenía `set search_path = public,
-- pg_temp`, que es la defensa que un security definer necesita (nadie puede
-- hacerle resolver `catalogo_precios` a una tabla suya).
--
-- Lo demás que lee la función (precios, fotos, tarjetas, subcategorías,
-- productos publicados, config) ya era de lectura pública por RLS, así que
-- pasar a definer no expone nada nuevo: la única columna que gana respecto
-- de quien llama es `stock`, y de ahí sólo sale el array `pocasUnidades`.
create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
security definer
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

-- ── El stock, para el panel de admin y sólo para él ──────────────────────
-- Mismo patrón que mi_ruta_hoy() en envios_10_repartidor.sql: cuando la
-- restricción que hace falta es por FILA/PERSONA y el GRANT sólo sabe de
-- ROLES, el acceso se da por una función security definer que se chequea la
-- autorización adentro.
--
-- `where public.es_admin()`: un authenticated que no está en public.admins
-- recibe cero filas, aunque tenga execute sobre la función. es_admin() ya es
-- security definer (envios_00_base.sql) y mira auth.uid(), no algo que mande
-- el cliente.
--
-- Toma un array de códigos en vez de devolver la tabla entera a propósito:
-- catalogo_precios tiene ~3713 filas y PostgREST corta en 1000 SIN ERROR
-- (ver el comentario largo de catalogo_00_base.sql). El panel pide sólo los
-- códigos que está mostrando, de a tandas — ver cargarPublicado() en
-- assets/admin-catalogo.js.
create or replace function public.catalogo_precios_admin(p_codigos text[])
returns table (codigo text, precio integer, sin_stock boolean, stock integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.codigo, p.precio, p.sin_stock, p.stock
  from public.catalogo_precios p
  where public.es_admin()
    and p.codigo = any(coalesce(p_codigos, '{}'::text[]));
$$;

revoke execute on function public.catalogo_precios_admin(text[]) from public, anon;
grant execute on function public.catalogo_precios_admin(text[]) to authenticated;
