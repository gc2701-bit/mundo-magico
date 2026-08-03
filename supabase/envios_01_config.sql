-- E1 — Configuración de envíos en Postgres (zonas, tarifas, franjas,
-- sucursales, cupos, bloqueos, repartidores).
-- Correr una sola vez en el SQL Editor del proyecto de pedidos
-- (https://kyuilrlewynqrzebouww.supabase.co), DESPUÉS de envios_00_base.sql.
--
-- Toda la configuración que antes hubiera quedado escrita a mano en
-- constantes de JavaScript vive acá, editable desde admin-envios.html (E2)
-- sin tocar código. Esta migración sólo crea las tablas y las llena con
-- datos iniciales razonables — varios de esos valores (sobre todo las
-- tarifas en pesos) son placeholders para poder probar el flujo completo y
-- hay que ajustarlos desde el panel antes de cobrar de verdad.
--
-- Esta migración NO toca la tabla `pedidos` — eso es de envios_02_pedidos.sql
-- (E3), incluida la migración de `zona` (texto libre) a `zona_id`.

-- ── Tarifas (bandas de precio con nombre) ───────────────────────────────
create table public.envio_tarifas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  costo numeric not null default 0 check (costo >= 0),
  orden int not null default 0,
  activa boolean not null default true
);

insert into public.envio_tarifas (nombre, costo, orden) values
  ('Capital', 2000, 1),
  ('Cercano', 3500, 2),
  ('Lejano', 5500, 3);
-- ↑ montos de ejemplo: ajustar desde admin-envios.html antes de cobrar envíos reales.

-- ── Zonas: corredores que apuntan hacia el interior ─────────────────────
-- `alias` guarda los textos libres que usaba el <select> viejo de
-- carrito.js, para poder migrar pedidos ya guardados sin reescribir nada
-- (ver envios_02_pedidos.sql). Un alias ambiguo (p. ej. "San Miguel de
-- Tucumán" solo, sin corredor) queda afuera a propósito: es mejor marcarlo
-- para revisar a mano que adivinar el corredor.
create table public.envio_zonas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text,
  grupo_ruta text not null check (grupo_ruta in ('centro', 'oeste', 'norte', 'este', 'sur')),
  orden_ruta int not null default 0,
  tarifa_id uuid not null references public.envio_tarifas(id),
  dias_semana smallint[] not null default '{1,2,3,4,5,6}',
  km_centro numeric,
  alias text[] not null default '{}',
  activa boolean not null default true
);

create index envio_zonas_grupo_ruta_idx on public.envio_zonas (grupo_ruta, orden_ruta);

insert into public.envio_zonas (slug, nombre, descripcion, grupo_ruta, orden_ruta, tarifa_id, km_centro, alias) values
  ('smt-microcentro', 'Microcentro', 'Dentro del perímetro del estacionamiento medido: Avellaneda–Sáenz Peña, Roca, Próspero Mena–Lucas Córdoba, Italia', 'centro', 1, (select id from public.envio_tarifas where nombre = 'Capital'), 0, '{}'),
  ('smt-oeste', 'San Miguel — Oeste', 'Eje Av. Mate de Luna / Aconquija', 'oeste', 1, (select id from public.envio_tarifas where nombre = 'Capital'), null, '{}'),
  ('cevil-redondo', 'Cevil Redondo', 'Pie de sierra, entre Yerba Buena y Tafí Viejo', 'oeste', 2, (select id from public.envio_tarifas where nombre = 'Cercano'), null, array['Cevil Redondo']),
  ('yerba-buena', 'Yerba Buena', 'Contigua al oeste de la capital', 'oeste', 3, (select id from public.envio_tarifas where nombre = 'Cercano'), 7.8, array['Yerba Buena']),
  ('smt-norte', 'San Miguel — Norte', 'Al norte de Av. Sarmiento / Ejército del Norte', 'norte', 1, (select id from public.envio_tarifas where nombre = 'Capital'), null, '{}'),
  ('las-talitas', 'Las Talitas', null, 'norte', 2, (select id from public.envio_tarifas where nombre = 'Cercano'), 6.0, '{}'),
  ('tafi-viejo', 'Tafí Viejo', null, 'norte', 3, (select id from public.envio_tarifas where nombre = 'Cercano'), null, '{}'),
  ('smt-este', 'San Miguel — Este', 'Eje Av. Alem, hacia el río', 'este', 1, (select id from public.envio_tarifas where nombre = 'Capital'), null, '{}'),
  ('banda-del-rio-sali', 'Banda del Río Salí', 'Cruzando el río hacia el este', 'este', 2, (select id from public.envio_tarifas where nombre = 'Cercano'), 7.1, array['Banda del Río Salí']),
  ('alderetes', 'Alderetes', null, 'este', 3, (select id from public.envio_tarifas where nombre = 'Cercano'), 9.5, '{}'),
  ('smt-sur', 'San Miguel — Sur', 'Al sur de Av. Roca', 'sur', 1, (select id from public.envio_tarifas where nombre = 'Capital'), null, '{}'),
  ('el-manantial', 'El Manantial', null, 'sur', 2, (select id from public.envio_tarifas where nombre = 'Lejano'), null, '{}'),
  ('san-pablo', 'San Pablo', null, 'sur', 3, (select id from public.envio_tarifas where nombre = 'Lejano'), null, array['San Pablo']),
  ('lules', 'Lules', 'La más lejana al sur', 'sur', 4, (select id from public.envio_tarifas where nombre = 'Lejano'), 15.7, array['Lules']);
-- Nota: 'San Miguel de Tucumán' (el valor libre viejo, sin corredor) queda
-- sin alias a propósito — no hay forma honesta de saber a qué corredor
-- apuntaba. Esos pedidos quedan sin zona_id y marcados para revisar (E3).

-- ── Franjas horarias (respetan la siesta y el sábado corto) ─────────────
create table public.envio_franjas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  hora_inicio time not null,
  hora_fin time not null,
  dias_semana smallint[] not null,
  orden int not null default 0,
  activa boolean not null default true
);

insert into public.envio_franjas (nombre, hora_inicio, hora_fin, dias_semana, orden) values
  ('Mañana', '09:00', '13:00', '{1,2,3,4,5}', 1),
  ('Tarde', '17:00', '21:00', '{1,2,3,4,5}', 2),
  ('Sábado', '09:00', '13:30', '{6}', 3);

-- ── Sucursales ───────────────────────────────────────────────────────────
create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text not null,
  es_deposito boolean not null default false,
  requiere_transferencia boolean not null default false,
  microcentro boolean not null default false,
  carga_hasta time,
  activa boolean not null default true
);

insert into public.sucursales (nombre, direccion, es_deposito, requiere_transferencia, microcentro, carga_hasta) values
  ('Junín 351', 'Junín 351, San Miguel de Tucumán', true, false, true, '20:00'),
  ('Junín 241', 'Junín 241, San Miguel de Tucumán', false, false, true, '20:00'),
  ('Córdoba 784', 'Córdoba 784, San Miguel de Tucumán', false, false, true, '20:00'),
  ('Solano Vera 510', 'Solano Vera 510, Yerba Buena', false, true, false, null);

-- ── Cupos: por corredor × día de la semana (isodow, 1=lunes…7=domingo) ──
-- El cupo pertenece al corredor, no a una zona puntual ni a la fecha: un
-- día lleno de Yerba Buena (corredor oeste) no bloquea un pedido a Banda
-- del Río Salí (corredor este), que sale en otro viaje.
create table public.envio_cupos (
  id uuid primary key default gen_random_uuid(),
  grupo_ruta text not null check (grupo_ruta in ('centro', 'oeste', 'norte', 'este', 'sur')),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  cupo_pedidos int not null default 20 check (cupo_pedidos > 0),
  cupo_bultos int not null default 40 check (cupo_bultos > 0),
  unique (grupo_ruta, dia_semana)
);

insert into public.envio_cupos (grupo_ruta, dia_semana, cupo_pedidos, cupo_bultos)
select g.grupo_ruta, d.dia_semana, 20, 40
from (values ('centro'), ('oeste'), ('norte'), ('este'), ('sur')) as g(grupo_ruta)
cross join (values (1), (2), (3), (4), (5), (6)) as d(dia_semana);
-- Domingo (7) queda sin fila a propósito: el local está cerrado.

-- ── Bloqueos (feriados, tormentas) ──────────────────────────────────────
create table public.envio_bloqueos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  grupo_ruta text check (grupo_ruta in ('centro', 'oeste', 'norte', 'este', 'sur')),
  motivo text not null,
  created_at timestamptz not null default now(),
  unique (fecha, grupo_ruta)
);
-- grupo_ruta null = bloquea todos los corredores ese día (feriado general).

-- ── Repartidores (propio o cadetería, sin cuenta en el sitio) ───────────
create table public.repartidores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'propio' check (tipo in ('propio', 'cadeteria')),
  telefono text,
  activo boolean not null default true
);

-- ── Configuración general (fila única) ──────────────────────────────────
create table public.envio_config (
  id int primary key default 1 check (id = 1),
  lead_dias int not null default 1 check (lead_dias >= 0),
  horizonte_dias int not null default 14 check (horizonte_dias > 0),
  dias_fijos_activos boolean not null default false,
  cobrar_envio boolean not null default true,
  minimo_compra numeric not null default 0 check (minimo_compra >= 0),
  minutos_carga int not null default 30 check (minutos_carga > 0),
  actualizado_at timestamptz not null default now()
);

insert into public.envio_config (id) values (1);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.envio_tarifas enable row level security;
alter table public.envio_zonas enable row level security;
alter table public.envio_franjas enable row level security;
alter table public.sucursales enable row level security;
alter table public.envio_config enable row level security;
alter table public.envio_cupos enable row level security;
alter table public.envio_bloqueos enable row level security;
alter table public.repartidores enable row level security;

-- Lectura pública: el carrito necesita leer zonas, tarifas, franjas,
-- sucursales y config antes de que el visitante tenga cuenta. Ninguna de
-- estas columnas es sensible (no hay margen ni pago a repartidores acá).
create policy "Lectura pública de tarifas" on public.envio_tarifas for select using (true);
create policy "Lectura pública de zonas" on public.envio_zonas for select using (true);
create policy "Lectura pública de franjas" on public.envio_franjas for select using (true);
create policy "Lectura pública de sucursales" on public.sucursales for select using (true);
create policy "Lectura pública de config" on public.envio_config for select using (true);

-- Escritura: sólo admin, en las mismas tablas de lectura pública.
create policy "Admin escribe tarifas" on public.envio_tarifas for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe zonas" on public.envio_zonas for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe franjas" on public.envio_franjas for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe sucursales" on public.sucursales for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin escribe config" on public.envio_config for all using (public.es_admin()) with check (public.es_admin());

-- Sólo admin, ni siquiera lectura pública: cupos y repartidores no son
-- información para mostrarle a un visitante (volumen de ventas, datos de
-- terceros que reparten).
create policy "Admin lee cupos" on public.envio_cupos for select using (public.es_admin());
create policy "Admin escribe cupos" on public.envio_cupos for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin lee bloqueos" on public.envio_bloqueos for select using (public.es_admin());
create policy "Admin escribe bloqueos" on public.envio_bloqueos for all using (public.es_admin()) with check (public.es_admin());
create policy "Admin lee repartidores" on public.repartidores for select using (public.es_admin());
create policy "Admin escribe repartidores" on public.repartidores for all using (public.es_admin()) with check (public.es_admin());
