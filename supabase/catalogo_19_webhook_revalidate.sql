-- Catálogo 19 — Database Webhook real hacia /api/revalidate.
--
-- Bug real reportado por el usuario (2026-08-26): el carrusel del home
-- ignoraba por completo el toggle "Mostrar en el carrusel del home"
-- (destacado_home) — tanto para sacar un artículo como para agregar uno
-- nuevo. Root cause: `/` es una página 100% estática
-- (`export const revalidate = false` en app/page.tsx) que sólo se
-- actualiza si algo llama a POST /api/revalidate (revalidateTag('catalogo'),
-- ver app/api/revalidate/route.ts) — y ESE llamado nunca existió. El
-- comentario de esa ruta ya documentaba "recibe el Database Webhook de
-- Supabase" como si estuviera armado, pero nunca se creó ningún trigger:
-- verificado contra pg_trigger de la base real (kyuilrlewynqrzebouww), no
-- había ninguno con http_post sobre catalogo_productos/catalogo_precios.
-- Tampoco existía la variable REVALIDATE_SECRET en Netlify, así que aunque
-- alguien hubiera llamado a la ruta a mano, esta la hubiera rechazado
-- (401). Confirmado con datos reales: el toggle SÍ escribe bien en la
-- base (1 producto con destacado_home=true), pero el home en producción
-- seguía mostrando el fallback ("primeros 6 publicados") congelado desde
-- el último deploy.
--
-- El secreto se guarda en Supabase Vault (nunca en texto plano en una
-- migración versionada en git) — el mismo valor se cargó como
-- REVALIDATE_SECRET en las variables de entorno de Netlify por fuera de
-- este repo.
select vault.create_secret(
  'ff926cfd367770b4cf035d71f3b4d6289dc3ce1bdbdcd116cc9dcc64cf71fbf1',
  'revalidate_secret',
  'Secreto compartido con Netlify (REVALIDATE_SECRET) para que el webhook de catalogo_productos/catalogo_precios pueda llamar a /api/revalidate.'
);

-- pg_net siempre crea su propio schema fijo "net" (no respeta `with schema`,
-- ver docs/guides/database/extensions/pg_net) — por eso la función se llama
-- después como net.http_post(), no extensions.http_post().
create extension if not exists pg_net;

-- Dispara la revalidación del home (tag 'catalogo') vía pg_net, server a
-- servidor — nunca desde el navegador. Mismo alcance que documentaba el
-- comentario original de app/api/revalidate/route.ts: catalogo_productos
-- (de donde sale destacado_home/precio_oferta/familia) y catalogo_precios
-- (precio/stock, aunque esas dos ya se resuelven client-side sin depender
-- de esta revalidación — no hace daño incluirla, es el alcance que ya
-- estaba documentado).
create or replace function public.catalogo_revalidar_home()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
begin
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

-- FOR EACH STATEMENT, no FOR EACH ROW: el worker de Búho sincroniza
-- catalogo_precios en lotes de miles de filas en un solo UPDATE (~3.654
-- filas en un minuto, ver mundomagicoweb-admin-catalogo-panel) — un
-- trigger por fila mandaría miles de HTTP calls por lote, muy por encima
-- del límite de pg_net (200 req/s). Una sola llamada por sentencia alcanza,
-- ya que sólo importa "algo cambió", no qué fila.
drop trigger if exists trg_catalogo_productos_revalidar on public.catalogo_productos;
create trigger trg_catalogo_productos_revalidar
  after insert or update or delete on public.catalogo_productos
  for each statement execute function public.catalogo_revalidar_home();

drop trigger if exists trg_catalogo_precios_revalidar on public.catalogo_precios;
create trigger trg_catalogo_precios_revalidar
  after insert or update or delete on public.catalogo_precios
  for each statement execute function public.catalogo_revalidar_home();
