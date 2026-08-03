-- E14 — Interruptor para apagar el reparto propio sin perder la
-- infraestructura (zonas, tarifas, cupos, rutas, repartidores).
-- Correr una sola vez en el SQL Editor, DESPUÉS de envios_01_config.sql.
--
-- Por qué un interruptor y no borrar nada: hoy el envío a domicilio lo deja
-- de hacer el local — el cliente lo arma por su cuenta (remis, Uber Moto,
-- Uber Envíos) y lo paga aparte. Pero puede volver a cambiar más adelante,
-- y todo lo que ya existe (envio_zonas, envio_tarifas, envio_cupos, las
-- rutas de ruta.html) sigue intacto — sólo se apaga la parte visible para
-- el cliente (costo por zona, elegir fecha/franja) mientras esta columna
-- esté en false. RLS/GRANT de envio_config no cambian: ya alcanza con la
-- política "Admin escribe config" que existe desde envios_01_config.sql.
alter table public.envio_config
  add column if not exists entrega_propia boolean not null default true;

-- Lo que pidieron: que la aclaración de "lo coordinás vos" quede activa
-- ya mismo. Para volver al reparto propio del local, alcanza con:
--   update public.envio_config set entrega_propia = true where id = 1;
update public.envio_config set entrega_propia = false where id = 1;
