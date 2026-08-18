-- Catálogo 06 — Config de catálogo (fila única). Hoy solo trae el umbral
-- de "pocas unidades" (ver catalogo_07_stock_precios.sql); pensada para
-- sumar más parámetros de catálogo después sin tabla nueva.
-- Correr DESPUÉS de catalogo_00_base.sql.
create table if not exists public.catalogo_config (
  id                       boolean primary key default true,
  umbral_pocas_unidades    integer not null default 5 check (umbral_pocas_unidades >= 0),
  actualizado_en           timestamptz not null default now(),
  actualizado_por          uuid references auth.users,
  constraint catalogo_config_single_row check (id)
);
insert into public.catalogo_config (id) values (true) on conflict (id) do nothing;

alter table public.catalogo_config enable row level security;

drop policy if exists "Lectura pública de config de catálogo" on public.catalogo_config;
create policy "Lectura pública de config de catálogo" on public.catalogo_config for select using (true);

drop policy if exists "Admin edita config de catálogo" on public.catalogo_config;
create policy "Admin edita config de catálogo" on public.catalogo_config for all
  using (public.es_admin()) with check (public.es_admin());

revoke insert, update, delete on public.catalogo_config from anon, authenticated;
grant update (umbral_pocas_unidades) on public.catalogo_config to authenticated;

drop trigger if exists catalogo_config_sello on public.catalogo_config;
create trigger catalogo_config_sello
  before update on public.catalogo_config
  for each row execute function public.catalogo_sello();
