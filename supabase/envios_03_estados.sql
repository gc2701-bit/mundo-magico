-- E4 — Máquina de estados + auditoría.
-- Correr una sola vez en el SQL Editor del proyecto de pedidos, DESPUÉS de
-- envios_00_base.sql, envios_01_config.sql y envios_02_pedidos.sql.
--
-- IMPORTANTE: correr este SQL antes de publicar el JS de E4. Al revés, cada
-- cambio de estado desde el panel da 400 contra el CHECK viejo (que sólo
-- conocía los 6 estados originales) y el panel queda muerto.
--
-- El nombre real del constraint de `estado` se verificó a mano antes de
-- escribir esto (select conname from pg_constraint where conrelid =
-- 'public.pedidos'::regclass and contype = 'c') — es autogenerado y
-- adivinarlo mal deja la migración a mitad de camino: en este proyecto es
-- `pedidos_estado_check`.

alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in (
    'nuevo', 'confirmado', 'en_preparacion', 'en_transito', 'listo',
    'en_reparto', 'entregado', 'ausente', 'reprogramado', 'cancelado'
  ));
-- en_transito: sólo retiros en Yerba Buena (viaja en el camión del oeste).
-- en_reparto: sólo envíos, salió hoy.
-- ausente: intento de entrega fallido (ver motivo_ausente e intentos_entrega).
-- reprogramado: cola de pedidos esperando una fecha nueva.

alter table public.pedidos
  add column if not exists intentos_entrega int not null default 0,
  add column if not exists motivo_ausente text
    check (motivo_ausente in (
      'nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo',
      'zona_inundada', 'vehiculo', 'otro'
    ));

-- ── Auditoría: quién cambió qué estado y cuándo ─────────────────────────
create table public.pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  actor uuid,
  actor_email text,
  motivo text,
  nota text,
  created_at timestamptz not null default now()
);

create index pedido_eventos_pedido_id_idx on public.pedido_eventos (pedido_id);

alter table public.pedido_eventos enable row level security;

-- Sólo lectura. Nadie inserta/actualiza/borra desde el cliente — lo hace
-- únicamente el trigger de abajo (security definer), así que no hace falta
-- (ni conviene) una política de insert: es la forma de que un cambio de
-- estado no se pueda falsificar ni borrar desde el navegador.
create policy "Admin lee todo el historial" on public.pedido_eventos
  for select using (public.es_admin());
create policy "Cliente lee el historial de sus pedidos" on public.pedido_eventos
  for select using (
    exists (select 1 from public.pedidos p where p.id = pedido_id and p.user_id = (select auth.uid()))
  );

-- ── El trigger que escribe la auditoría ─────────────────────────────────
-- AFTER UPDATE (no BEFORE): lee el actor del JWT de la request, y el
-- incremento de intentos_entrega es un UPDATE aparte — no puede tocar NEW
-- porque la fila ya se guardó. Ese UPDATE vuelve a disparar este mismo
-- trigger, pero como no cambia `estado` la condición de abajo no vuelve a
-- insertar un evento ni a incrementar de nuevo: no hay recursión infinita.
create or replace function public.pedidos_registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims json;
  v_actor uuid;
  v_email text;
begin
  if new.estado is distinct from old.estado then
    begin
      v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
      v_actor := nullif(v_claims->>'sub', '')::uuid;
      v_email := v_claims->>'email';
    exception when others then
      v_actor := null;
      v_email := null;
    end;

    insert into public.pedido_eventos (pedido_id, estado_anterior, estado_nuevo, actor, actor_email, motivo)
    values (new.id, old.estado, new.estado, v_actor, v_email,
      case when new.estado = 'ausente' then new.motivo_ausente end);

    if new.estado = 'ausente' then
      update public.pedidos set intentos_entrega = intentos_entrega + 1 where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_registrar_cambio on public.pedidos;
create trigger trg_pedidos_registrar_cambio
  after update on public.pedidos
  for each row execute function public.pedidos_registrar_cambio();
