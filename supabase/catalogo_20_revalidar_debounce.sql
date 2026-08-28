-- Catálogo 20 — debounce del webhook de revalidación (Sprint 3 del fix del
-- incidente de producción 2026-08-28, ver tasks/plan.md en mundo-magico/).
--
-- catalogo_revalidar_home() (catalogo_19_webhook_revalidate.sql) dispara en
-- cada UPDATE de catalogo_productos/catalogo_precios (FOR EACH STATEMENT).
-- Medido contra la base real: el worker de Búho sincroniza en muchos UPDATE
-- chicos, no uno solo grande — ráfagas reales de 16-18 llamadas a
-- /api/revalidate en 2-3 segundos, cada ~15 minutos (net._http_response).
-- No era la causa raíz del 404 de producción (ya arreglada aparte —
-- app/api/revalidate/route.ts ahora usa revalidateTag(tag, 'max') en vez
-- de {expire:0}), pero es carga innecesaria sobre Supabase/Netlify sin
-- ningún beneficio: a catalogo_publico() sólo le importa "algo cambió",
-- no cuántas veces. Debounce de 10s: alcanza y sobra para que un cambio
-- humano desde el panel de admin se sienta instantáneo, y colapsa una
-- ráfaga completa del worker a una sola llamada.
--
-- Se reusa catalogo_config (fila única, pensada en catalogo_06_config.sql
-- "para sumar más parámetros de catálogo después sin tabla nueva") en vez
-- de crear una tabla nueva sólo para esto.
--
-- Nota de seguridad (2026-08-28): junto con esta migración se rotó
-- REVALIDATE_SECRET (Vault + env var de Netlify) porque el valor anterior
-- había quedado commiteado en texto plano en catalogo_19_webhook_revalidate.sql,
-- en este repo público. La rotación se aplicó aparte, fuera de un archivo
-- versionado — el valor nuevo nunca se escribe en git. Cualquier secreto
-- futuro de este tipo va por el mismo camino: generado y aplicado directo
-- a Vault/Netlify, nunca embebido en una migración.
alter table public.catalogo_config
  add column if not exists ultima_revalidacion timestamptz not null default '-infinity';

create or replace function public.catalogo_revalidar_home()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
  v_debounce_ok boolean;
begin
  -- UPDATE atómico con WHERE + RETURNING: bajo triggers concurrentes,
  -- sólo el primero que entra a la ventana de 10s gana y sigue de largo;
  -- el resto ve la fila ya actualizada y se corta acá sin llamar al
  -- webhook.
  update public.catalogo_config
  set ultima_revalidacion = now()
  where id = true
    and ultima_revalidacion < now() - interval '10 seconds'
  returning true into v_debounce_ok;

  if v_debounce_ok is not true then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'revalidate_secret';

  if v_secret is not null then
    perform net.http_post(
      url := 'https://mundomagico.ar/api/revalidate',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-revalidate-secret', v_secret
      )
    );
  end if;

  return null;
end;
$$;
