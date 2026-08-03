-- E11 — Restringir el UPDATE de admin a las columnas que de verdad gestiona.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql … envios_10_repartidor.sql.
--
-- El comentario de envios_00_base.sql decía que agregar WITH CHECK
-- resolvía que "un admin podía reescribir cualquier columna del pedido,
-- no sólo el estado" — pero `with check (public.es_admin())` no depende de
-- ninguna columna: sigue permitiendo pisar precio, items, dirección,
-- cualquier cosa. RLS filtra FILAS, no columnas; para columnas hace falta
-- GRANT/REVOKE, que es lo que hace este archivo.
--
-- No afecta a repartidor_marcar() (envios_10): esa función es
-- security definer y escribe con sus propios privilegios internos, no con
-- los del rol `authenticated` que se restringe acá.
--
-- La lista de columnas es exactamente lo que hoy actualiza admin-pedidos.js
-- (buscar `sb.from('pedidos').update(` en ese archivo): estado, bultos,
-- motivo_ausente, orden_parada, fecha_entrega, franja_id y repartidor_id.
-- Si el panel empieza a editar una columna nueva, hay que sumarla acá
-- también o el UPDATE le va a fallar con "permission denied for column".

revoke update on public.pedidos from anon, authenticated;

grant update (
  estado, motivo_ausente, bultos, orden_parada,
  fecha_entrega, franja_id, repartidor_id
) on public.pedidos to authenticated;
