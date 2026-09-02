-- Analytics 00 — tracking propio de visitas y ranking de artículos
-- consultados, para /admin/analiticas (Sprint F del dashboard admin, ver
-- SPEC-dashboard-admin.md y tasks/plan-dashboard-admin.md). Correr en el
-- proyecto de catálogo/pedidos (kyuilrlewynqrzebouww), DESPUÉS de
-- envios_00_base.sql (necesita public.es_admin()).
--
-- Cuenta a TODOS los visitantes, anónimos incluidos (decisión explícita
-- del usuario: es la única forma de tener un número real de "visitas" —
-- casi nadie navega el catálogo logueado). Sesión anónima = un UUID
-- propio guardado en localStorage del browser (lib/analytics-tracking.ts,
-- mismo patrón que ya usa el carrito con `mm_carrito_v2`), sin relación
-- con Google Analytics/Clarity ni con ninguna cookie de terceros. Nunca se
-- guarda IP.
--
-- Desviación del diseño original del spec (documentada acá, no en
-- silencio): el spec proponía escribir sólo vía un Route Handler con
-- SERVICE ROLE, para no abrir un INSERT anónimo por RLS. Se descartó al
-- implementar: este proyecto documenta explícitamente en lib/supabase.ts
-- que "todo el sitio... depende de RLS, nunca de service_role" — sumar
-- una service role key nueva a las variables de entorno de Netlify sólo
-- para esto es más superficie/riesgo que el problema que resuelve. En su
-- lugar, INSERT abierto por RLS (mismo nivel de confianza que ya tiene la
-- anon key pública del resto del sitio), con un CHECK acotado (sólo 2
-- tipos válidos) — igual trade-off que cualquier analítica que corre en
-- el browser (GA/Clarity son igual de "abusables" llamando su API
-- directo). SELECT sigue restringido a es_admin(), igual que todo lo
-- demás.
create table if not exists public.analytics_eventos (
  id uuid primary key default gen_random_uuid(),
  sesion_anonima uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('pageview', 'vista_producto')),
  ruta text not null,
  created_at timestamptz not null default now()
);

alter table public.analytics_eventos enable row level security;

create policy "Cualquiera registra sus propios eventos de analítica"
  on public.analytics_eventos for insert
  to anon, authenticated
  with check (true);

create policy "Los admins leen las analíticas"
  on public.analytics_eventos for select
  using (public.es_admin());

create index if not exists analytics_eventos_created_at_idx
  on public.analytics_eventos (created_at);
create index if not exists analytics_eventos_ruta_idx
  on public.analytics_eventos (ruta) where tipo = 'vista_producto';

-- ── Visitas por día (pageviews, incluye vista_producto: toda vista de
-- página cuenta como visita) ──────────────────────────────────────────────
create or replace function public.analytics_visitas_por_dia(p_dias int default 30)
returns table (fecha date, visitas bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select date_trunc('day', ae.created_at)::date as fecha, count(*) as visitas
  from public.analytics_eventos ae
  where public.es_admin()
    and ae.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
  group by 1
  order by 1;
$$;

revoke execute on function public.analytics_visitas_por_dia(int) from public, anon;
grant execute on function public.analytics_visitas_por_dia(int) to authenticated;

-- ── Ranking de artículos más consultados ─────────────────────────────────
-- Agrupa por `ruta`, no por código de producto: muchos productos usan
-- variantes/talles sin un código único a nivel de página (ver
-- lib/precios-familia.ts), así que `codigo` quedaría null para buena
-- parte del catálogo y subcontaría el ranking. `ruta` (ej.
-- "/globos-fiesta/abanico-luminoso") siempre existe — son los mismos dos
-- segmentos que ya usa la ruta [mundo]/[slug] — y permite resolver
-- mundo/slug con split_part() para el join real.
create or replace function public.analytics_ranking_productos(p_dias int default 30, p_limite int default 20)
returns table (ruta text, vistas bigint, titulo text, mundo text, slug text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with conteo as (
    select ae.ruta, count(*) as vistas
    from public.analytics_eventos ae
    where public.es_admin()
      and ae.tipo = 'vista_producto'
      and ae.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
    group by ae.ruta
  )
  select
    c.ruta, c.vistas, p.titulo,
    split_part(btrim(c.ruta, '/'), '/', 1) as mundo,
    split_part(btrim(c.ruta, '/'), '/', 2) as slug
  from conteo c
  left join public.catalogo_productos p
    on p.mundo = split_part(btrim(c.ruta, '/'), '/', 1)
   and p.slug = split_part(btrim(c.ruta, '/'), '/', 2)
  order by c.vistas desc
  limit greatest(p_limite, 1);
$$;

revoke execute on function public.analytics_ranking_productos(int, int) from public, anon;
grant execute on function public.analytics_ranking_productos(int, int) to authenticated;
