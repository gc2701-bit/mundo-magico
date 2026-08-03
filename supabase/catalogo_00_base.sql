-- Catálogo 00 — Precio, stock y ocultar, editables desde la web.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos
-- (https://kyuilrlewynqrzebouww.supabase.co → SQL Editor → New query),
-- DESPUÉS de envios_00_base.sql (necesita public.es_admin()).
--
-- Reemplaza a la Google Sheet como fuente de verdad de los precios. La
-- cascada de resolución de código sigue viviendo en assets/precios.js
-- (Resolutor/candidatos) — acá sólo están los tres mapas que esa cascada
-- necesita, con la MISMA clave que ya usa el sitio:
--   - catalogo_precios: precio y stock por código del POS. Es lo que hoy
--     tiene la pestaña "Precios" de la Sheet.
--   - catalogo_fotos: qué código le corresponde a la foto de una tarjeta
--     que no lo declara en data-pos. Reemplaza la pestaña "Codigos".
--   - catalogo_tarjetas: lo que un admin decide SOBRE UNA TARJETA que vive
--     escrita a mano en el HTML y que no se puede editar desde el
--     navegador — ocultarla, marcarla sin stock cuando no resuelve a
--     ningún código, o pisar el precio de un combo.
--
-- El código se compara EXACTO, con los ceros a la izquierda: '01985' y
-- '1985' son productos distintos (ver el mismo comentario en precios.js).
-- Por eso `codigo` es `text`, nunca `integer` ni `numeric`.

-- ── Precios y stock, por código del POS ──────────────────────────────────
create table if not exists public.catalogo_precios (
  codigo          text primary key,
  precio          integer not null check (precio > 0),
  sin_stock       boolean not null default false,
  nombre_pos      text,                          -- sólo referencia humana
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users,
  constraint catalogo_precios_codigo_limpio
    check (codigo = btrim(codigo) and length(codigo) between 1 and 16)
);

-- ── Foto → código, para tarjetas sin data-pos propio ────────────────────
-- La clave es la ruta de la foto DECODIFICADA (espacios y acentos de
-- verdad, no %20/%C3%B1) — es lo que deja `rutaLimpia()` en precios.js
-- antes de buscar en este mapa, y lo que va a mandar admin-catalogo.js.
create table if not exists public.catalogo_fotos (
  ruta            text primary key,
  codigo          text not null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users
);

-- ── Qué decidió un admin sobre una tarjeta del HTML ─────────────────────
-- (pagina, slug) es la misma identidad que ya usan los deep links del
-- buscador (site.js `?p=slug`, slugify del <h3>): no hay colisiones de
-- slug dentro de una misma página, verificado sobre las 328 tarjetas
-- actuales.
--
-- titulo_ref guarda el <h3> tal cual estaba al guardar esta fila: si
-- alguien renombra el producto en el HTML después, el slug cambia y esta
-- fila queda huérfana (deja de aplicar EN SILENCIO). titulo_ref es lo que
-- permite detectarlo — ver .claude/check-catalogo.js.
create table if not exists public.catalogo_tarjetas (
  pagina          text not null,
  slug            text not null,
  oculta          boolean not null default false,
  sin_stock       boolean,                       -- null = "sin opinión, mirá el código"
  precio_fijo     integer check (precio_fijo is null or precio_fijo > 0),
  titulo_ref      text,
  nota            text,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users,
  primary key (pagina, slug)
);

-- ── Auditoría: quién tocó qué y cuándo, sin confiar en lo que mande el cliente ──
-- El cliente NUNCA tiene GRANT sobre actualizado_en/actualizado_por (ver
-- más abajo) — los pone este trigger. Es justamente lo que hace que estas
-- dos columnas sirvan como auditoría real.
create or replace function public.catalogo_sello()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists catalogo_precios_sello  on public.catalogo_precios;
drop trigger if exists catalogo_fotos_sello    on public.catalogo_fotos;
drop trigger if exists catalogo_tarjetas_sello on public.catalogo_tarjetas;

create trigger catalogo_precios_sello
  before insert or update on public.catalogo_precios
  for each row execute function public.catalogo_sello();

create trigger catalogo_fotos_sello
  before insert or update on public.catalogo_fotos
  for each row execute function public.catalogo_sello();

create trigger catalogo_tarjetas_sello
  before insert or update on public.catalogo_tarjetas
  for each row execute function public.catalogo_sello();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.catalogo_precios  enable row level security;
alter table public.catalogo_fotos    enable row level security;
alter table public.catalogo_tarjetas enable row level security;

-- Lectura pública: son precios de una tienda, están para que se vean —
-- mismo criterio que envio_zonas/envio_tarifas en envios_01_config.sql.
create policy "Lectura pública de precios"  on public.catalogo_precios  for select using (true);
create policy "Lectura pública de fotos"    on public.catalogo_fotos    for select using (true);
create policy "Lectura pública de tarjetas" on public.catalogo_tarjetas for select using (true);

create policy "Admin escribe precios"  on public.catalogo_precios  for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe fotos"    on public.catalogo_fotos    for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe tarjetas" on public.catalogo_tarjetas for all using (public.es_admin()) with check (public.es_admin());

-- ── GRANT/REVOKE de columna ──────────────────────────────────────────────
-- Mismo motivo que envios_11_admin_columnas.sql: RLS filtra FILAS, no
-- columnas. `with check(es_admin())` no le impide a un admin pisar
-- `codigo` en un UPDATE — y reasignar el código de una fila cambiaría en
-- silencio el precio de un producto a otro (el precio se seguiría
-- pintando, sólo que sobre el artículo equivocado). Por eso `codigo` sólo
-- se puede escribir al crear la fila (INSERT), nunca en un UPDATE.
--
-- Tampoco hay GRANT de DELETE en catalogo_precios: para "no vender más"
-- está sin_stock; borrar un precio deja la tarjeta muda sin ningún aviso.
revoke insert, update, delete on public.catalogo_precios from anon, authenticated;
grant insert (codigo, precio, sin_stock, nombre_pos) on public.catalogo_precios to authenticated;
grant update (precio, sin_stock)                     on public.catalogo_precios to authenticated;

revoke insert, update, delete on public.catalogo_fotos from anon, authenticated;
grant insert (ruta, codigo) on public.catalogo_fotos to authenticated;
grant update (codigo)       on public.catalogo_fotos to authenticated;
grant delete                on public.catalogo_fotos to authenticated;

revoke insert, update, delete on public.catalogo_tarjetas from anon, authenticated;
grant insert (pagina, slug, oculta, sin_stock, precio_fijo, titulo_ref, nota) on public.catalogo_tarjetas to authenticated;
grant update (oculta, sin_stock, precio_fijo, nota)                          on public.catalogo_tarjetas to authenticated;
grant delete                                                                 on public.catalogo_tarjetas to authenticated;

-- ── Lectura pública, en un solo viaje ────────────────────────────────────
-- catalogo_precios va a tener miles de filas (3713 al migrar). Un
-- `.select()` pelado desde el cliente corta en el límite de filas de
-- PostgREST (1000 en la config por defecto) SIN NINGÚN ERROR — cientos de
-- tarjetas se quedarían sin precio en silencio. Por eso la web nunca hace
-- select directo a estas tablas: pide este único JSON ya agregado.
--
-- No es security definer: las políticas de lectura pública de arriba ya
-- alcanzan, así que si el día de mañana se restringe algo de lectura, esta
-- función se restringe sola con eso (corre con los privilegios de quien
-- llama, no con los del dueño de la función).
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
            coalesce((select max(actualizado_en) from public.catalogo_tarjetas), 'epoch'::timestamptz)
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
                 jsonb_build_object('oculta', oculta, 'sinStock', sin_stock, 'precioFijo', precio_fijo)
               )
       from public.catalogo_tarjetas
       where oculta or sin_stock is not null or precio_fijo is not null), '{}'::jsonb)
  );
$$;

revoke execute on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated;
