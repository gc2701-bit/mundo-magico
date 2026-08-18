-- Catálogo 05 — Espejo de Búho: réplica de solo-lectura-para-humanos del
-- catálogo activo del ERP local (depósito 102, "Salón de Venta"), que un
-- worker externo (todavía no escrito, ver
-- handoff-worker-buho/02-espejo-catalogo-design.md) va a sincronizar acá.
-- Correr en el SQL Editor del proyecto de catálogo (kyuilrlewynqrzebouww),
-- DESPUÉS de catalogo_00_base.sql (necesita public.es_admin()).
--
-- El worker nunca escribe directo en catalogo_precios/catalogo_productos —
-- siempre pasa por acá primero. Un humano "activa" un código desde el panel
-- de admin (assets/admin-catalogo.js, pestaña "Sin activar"), lo que crea/
-- actualiza la fila correspondiente en catalogo_precios/catalogo_productos
-- y pone publicado=true. Motivo: catalogo_publico() se descarga completo en
-- cada visita — volcar ahí el espejo entero (sin curar por familia) le
-- sumaría a cada visitante miles de artículos sin foto ni tarjeta.
create table if not exists public.catalogo_buho_espejo (
  codigo          text primary key,   -- ARTICU.ArtId de Búho
  nombre          text not null,      -- ARTICU.ArtNom
  familia         text,               -- FAMILI.FamNom, taxonomía propia de Búho, sin mapear al sitio
  precio          integer not null check (precio > 0),  -- ARTICU.ArtMinPUFi
  stock           integer,            -- null en combos hasta validar esa fórmula (fuera de alcance)
  es_combo        boolean not null default false,
  activo_en_buho  boolean not null default true,
  publicado       boolean not null default false,   -- true = un humano ya lo activó
  actualizado_en  timestamptz not null default now(),
  constraint catalogo_buho_espejo_codigo_limpio
    check (codigo = btrim(codigo) and length(codigo) between 1 and 16)
);

alter table public.catalogo_buho_espejo enable row level security;

-- El worker (cuando exista) usa service_role, que bypasea RLS. Esta policy
-- es para el panel de admin: nadie público lee ni escribe esta tabla.
drop policy if exists "Admin lee y edita el espejo" on public.catalogo_buho_espejo;
create policy "Admin lee y edita el espejo" on public.catalogo_buho_espejo
  for all using (public.es_admin()) with check (public.es_admin());

-- Búsqueda por nombre/familia sin escanear toda la tabla a medida que
-- crece con la migración completa de Búho — solo afecta la velocidad del
-- panel de admin, catalogo_publico() nunca toca esta tabla.
create extension if not exists pg_trgm;
create index if not exists catalogo_buho_espejo_nombre_trgm
  on public.catalogo_buho_espejo using gin (nombre gin_trgm_ops);
create index if not exists catalogo_buho_espejo_familia_idx
  on public.catalogo_buho_espejo (familia);
create index if not exists catalogo_buho_espejo_publicado_idx
  on public.catalogo_buho_espejo (publicado, activo_en_buho);
