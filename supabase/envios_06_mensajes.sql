-- E7 — Comunicación con el cliente: plantillas de mensaje por estado.
-- Correr una sola vez, DESPUÉS de envios_00 a envios_05.
--
-- No hay cron ni envío automático: el sitio es estático y sin servidor.
-- Esta tabla sólo guarda la REDACCIÓN de cada mensaje para poder cambiarla
-- sin publicar código; quien manda el mensaje sigue siendo una persona
-- tocando un link de wa.me (ver admin-pedidos.js).

create table public.mensajes_plantillas (
  estado text primary key check (estado in (
    'nuevo', 'confirmado', 'en_preparacion', 'en_transito', 'listo',
    'en_reparto', 'entregado', 'ausente', 'reprogramado', 'cancelado'
  )),
  cuerpo text not null,
  activa boolean not null default true
);
-- El mismo dominio de valores que el CHECK de pedidos.estado (ver
-- envios_03_estados.sql) — no hay forma de poner una FK real ahí porque
-- `estado` no es único en `pedidos` (muchas filas comparten el mismo
-- valor). Si ese CHECK cambia, este se actualiza a mano junto con él.

insert into public.mensajes_plantillas (estado, cuerpo) values
  ('nuevo', 'Hola {nombre}! Recibimos tu pedido #{numero} en Mundo Mágico. En breve te confirmamos disponibilidad y el total. Podés seguirlo desde tu cuenta en la web.'),
  ('confirmado', 'Hola {nombre}! Confirmamos tu pedido #{numero}. Te lo entregamos el {fecha} en el horario {franja}. Podés seguir el estado desde tu cuenta en la web. Cualquier consulta, escribinos por acá.'),
  ('listo', 'Hola {nombre}! Tu pedido #{numero} ya está listo para el {fecha} ({franja}).'),
  ('en_reparto', 'Hola {nombre}! Tu pedido #{numero} salió para entregarse hoy en {zona}. Franja estimada: {franja}.'),
  ('entregado', 'Hola {nombre}! Tu pedido #{numero} fue entregado. ¡Gracias por elegirnos!'),
  ('ausente', 'Hola {nombre}! Pasamos a entregar tu pedido #{numero} pero no encontramos a nadie. Escribinos para coordinar una nueva fecha.'),
  ('reprogramado', 'Hola {nombre}! Reprogramamos tu pedido #{numero} para el {fecha} ({franja}).'),
  ('cancelado', 'Hola {nombre}! Tu pedido #{numero} quedó cancelado. Cualquier duda, escribinos por acá.');

alter table public.mensajes_plantillas enable row level security;

create policy "Admin lee plantillas" on public.mensajes_plantillas for select using (public.es_admin());
create policy "Admin escribe plantillas" on public.mensajes_plantillas for all using (public.es_admin()) with check (public.es_admin());
