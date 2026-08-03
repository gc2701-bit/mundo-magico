-- E8 — Coordenadas aproximadas del centro de cada zona.
--
-- Sirven para un solo chequeo, no para dibujar mapas: en envio-form.js, si
-- la dirección que tipeó el cliente geocodifica lejos del centro de la zona
-- que eligió en el <select>, se muestra un aviso ("¿elegiste la zona
-- correcta?"). No bloquea el pedido — el cliente puede seguir igual — es
-- sólo para que no se le pase por alto un error de tipeo o de zona.
--
-- Un punto por zona alcanza porque estas zonas son corredores informales
-- (ver descripcion de cada una en envios_01_config.sql), no barrios con
-- límite exacto — no vale la pena guardar un polígono para esto.

alter table public.envio_zonas add column lat numeric;
alter table public.envio_zonas add column lng numeric;

update public.envio_zonas set lat = -26.8252, lng = -65.2251 where slug = 'smt-microcentro';
update public.envio_zonas set lat = -26.8279, lng = -65.2203 where slug = 'smt-oeste';
update public.envio_zonas set lat = -26.8002, lng = -65.2600 where slug = 'cevil-redondo';
update public.envio_zonas set lat = -26.8216, lng = -65.3045 where slug = 'yerba-buena';
update public.envio_zonas set lat = -26.8144, lng = -65.2299 where slug = 'smt-norte';
update public.envio_zonas set lat = -26.7899, lng = -65.1897 where slug = 'las-talitas';
update public.envio_zonas set lat = -26.7362, lng = -65.2576 where slug = 'tafi-viejo';
update public.envio_zonas set lat = -26.8404, lng = -65.2214 where slug = 'smt-este';
update public.envio_zonas set lat = -26.8386, lng = -65.1658 where slug = 'banda-del-rio-sali';
update public.envio_zonas set lat = -26.8224, lng = -65.1441 where slug = 'alderetes';
update public.envio_zonas set lat = -26.8424, lng = -65.2125 where slug = 'smt-sur';
update public.envio_zonas set lat = -26.8479, lng = -65.2826 where slug = 'el-manantial';
update public.envio_zonas set lat = -26.8795, lng = -65.3138 where slug = 'san-pablo';
update public.envio_zonas set lat = -26.9254, lng = -65.3372 where slug = 'lules';
