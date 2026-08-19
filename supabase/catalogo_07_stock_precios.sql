-- Catálogo 07 — Columna stock en catalogo_precios (numérica, la llena el
-- worker de Búho para códigos ya publicados) y pocasUnidades en
-- catalogo_publico() (leyenda "quedan pocas unidades" — el número real de
-- stock NUNCA se expone al público, solo este array de códigos).
-- Correr DESPUÉS de catalogo_04_colores_sin_stock.sql.
alter table public.catalogo_precios
  add column if not exists stock integer;

-- Los DOS grants, no sólo el de update. El de insert de catalogo_00_base.sql
-- (línea 126) es `grant insert (codigo, precio, sin_stock, nombre_pos)`: sin
-- `stock` acá, el upsert de activarCodigo() en assets/admin-catalogo.js
-- (`{codigo, precio, stock, sin_stock}`) revienta con
-- `42501 permission denied for column stock` justo en la rama INSERT — o sea
-- en la PRIMERA activación de cada código, la que todavía no tiene fila de
-- precio — y encima después de que el insert en catalogo_productos ya salió
-- bien, dejando un producto publicado sin precio. La rama
-- `on conflict (codigo) do update` (código que ya tenía precio) siempre
-- funcionó: esa usa el grant de update de abajo, que sí incluye stock.
-- Los grants de columna son acumulativos: volver a correr esta línea sobre
-- una base donde catalogo_07 ya se aplicó es inofensivo (y necesario, si se
-- aplicó antes de este arreglo).
grant insert (codigo, precio, sin_stock, nombre_pos, stock) on public.catalogo_precios to authenticated;
grant update (precio, sin_stock, stock)                     on public.catalogo_precios to authenticated;

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
