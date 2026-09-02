-- Catálogo 21 — catalogo_metricas_admin(), para /admin/metricas (Sprint B
-- del dashboard admin, ver SPEC-dashboard-admin.md y
-- tasks/plan-dashboard-admin.md). Correr DESPUÉS de catalogo_20_revalidar_debounce.sql.
--
-- 5 conteos en una sola llamada:
--   publicados        — filas de catalogo_productos (una por tarjeta/producto).
--   sinFamilia        — de esas, cuántas no tienen `familia` cargada.
--   sinStock          — códigos EN USO por un producto publicado (directo o
--                        vía variantes) marcados sin_stock en catalogo_precios.
--   pocasUnidades     — mismo universo de códigos, con stock <= el umbral
--                        configurable de catalogo_config.umbral_pocas_unidades
--                        (el mismo que ya usa catalogo_publico() para el
--                        badge público "Últimas unidades").
--   esperandoActivar  — filas de catalogo_buho_espejo con publicado=false,
--                        excluyendo las que el propio Búho ya dio de baja
--                        (activo_en_buho=false) — esas no son un pendiente
--                        real, son historia.
--
-- Nota (hallazgo de la sesión 2026-09-02, ver memoria del proyecto): hoy hay
-- ~279 códigos con publicado=false que en realidad YA están publicados por
-- otra vía (alta manual, no por el botón "Activar" de esta pestaña) — este
-- número los va a seguir contando. Mostrar el número real es el objetivo de
-- este sprint; depurar esos 279 es un problema de datos aparte, todavía sin
-- tocar.
--
-- Mismo patrón que catalogo_precios_admin() (catalogo_08_stock_privado.sql):
-- security definer + `where public.es_admin()` al final, así un
-- authenticated sin permisos recibe cero filas en vez de un error — el
-- GRANT es por rol, la restricción real de fila la pone la función.
create or replace function public.catalogo_metricas_admin()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with codigos_publicados as (
    select codigo from public.catalogo_productos where codigo is not null
    union
    select v->>'codigo'
    from public.catalogo_productos, jsonb_array_elements(coalesce(variantes, '[]'::jsonb)) as v
    where v->>'codigo' is not null
  )
  select jsonb_build_object(
    'publicados', (select count(*) from public.catalogo_productos),
    'sinFamilia', (select count(*) from public.catalogo_productos where familia is null),
    'sinStock', (
      select count(*) from public.catalogo_precios cp
      join codigos_publicados c on c.codigo = cp.codigo
      where cp.sin_stock
    ),
    'pocasUnidades', (
      select count(*) from public.catalogo_precios cp
      join codigos_publicados c on c.codigo = cp.codigo
      where not cp.sin_stock
        and cp.stock is not null
        and cp.stock <= (select umbral_pocas_unidades from public.catalogo_config)
    ),
    'esperandoActivar', (
      select count(*) from public.catalogo_buho_espejo
      where not publicado and activo_en_buho
    )
  )
  where public.es_admin();
$$;

revoke execute on function public.catalogo_metricas_admin() from public, anon;
grant execute on function public.catalogo_metricas_admin() to authenticated;
