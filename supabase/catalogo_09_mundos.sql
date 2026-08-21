-- Catálogo 09 — Mundos como categorización pública (Sprint 5.5 de la
-- migración a Next.js, docs/superpowers/plans/2026-08-20-nextjs-migracion-
-- familias-plan.md). Correr DESPUÉS de catalogo_08_familia.sql.
--
-- El plan original de la migración (Sprint 1) reemplazaba mundos+
-- subcategorías por "familia" (plana, la manda Búho) como categorización
-- pública. El usuario pidió volver atrás: "mundo" es de nuevo lo público
-- (los mismos 7 de siempre, pero ahora extensible desde el panel admin,
-- no una lista fija en el código); "familia" queda como dato interno
-- (sigue viniendo de Búho, sólo se ve en el panel admin).
--
-- catalogo_mundos es más chica que la vieja catalogo_subcategorias: no
-- tiene FK a una "página" contenedora (mundo YA es el nivel de arriba),
-- ni relación con catalogo_tarjetas (eso quedó en el sitio Eleventy
-- viejo). slug es la clave primaria a propósito — es lo que usa la URL
-- pública (/[mundo]/page.tsx) y catalogo_productos.mundo referencia
-- directo contra ella (ver catalogo_10_publico_mundo.sql).

create table if not exists public.catalogo_mundos (
  slug   text primary key,
  nombre text not null,
  orden  integer not null default 0
);

insert into public.catalogo_mundos (slug, nombre, orden) values
  ('globos-fiesta', 'Cotillón',                1),
  ('cumpleanos',    'Cumpleaños',              2),
  ('decoracion',    'Decoración',              3),
  ('disfraces',     'Disfraces y accesorios',  4),
  ('reposteria',    'Repostería',              5),
  ('combos',        'Combos',                  6),
  ('especiales',    'Especiales',              7)
on conflict (slug) do nothing;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.catalogo_mundos enable row level security;

create policy "catalogo_mundos: lectura pública" on public.catalogo_mundos
  for select using (true);
create policy "catalogo_mundos: sólo admins escriben" on public.catalogo_mundos
  for all using (public.es_admin()) with check (public.es_admin());

-- ── GRANT/REVOKE ─────────────────────────────────────────────────────────
-- Mismo criterio que catalogo_subcategorias en catalogo_03_subcategorias.sql:
-- RLS ya exige es_admin() para escribir, pero no hace falta dejarle además
-- el GRANT de tabla por default a anon — sólo lectura ahí.
revoke insert, update, delete on public.catalogo_mundos from anon, authenticated;
grant insert (slug, nombre, orden) on public.catalogo_mundos to authenticated;
grant update (nombre, orden)       on public.catalogo_mundos to authenticated;
grant delete                       on public.catalogo_mundos to authenticated;
