import type { SupabaseClient } from '@supabase/supabase-js';
import { ESTADOS_TXT, fechaLegible, isodow, sumarDiasISO, hoyISO, plata, cuposDisponibles, zonaPorIdOSlug, type DatosEnvios, type Sucursal } from './envios';

/**
 * Panel de administración de pedidos (Sprint 5, Task 5.3) — lógica pura,
 * portada de public/assets/admin-pedidos.js. Cubre el ciclo operativo
 * central: listar/filtrar/agrupar, cambiar de estado, avisar por WhatsApp,
 * asignar fecha/franja a un envío.
 *
 * **Fuera de alcance de esta tanda** (documentado en el plan, misma
 * decisión que ya tomaron Tasks 5.1/5.2 con otras piezas grandes): el modo
 * de agrupación "plan de reparto" (orden de parada tipo vecino-más-cercano,
 * asignación de repartidor, tramos de Google Maps, reprogramación en lote
 * por cupo) y "traslado a sucursal" como agrupación aparte, el panel de
 * métricas (7 sub-reportes), el archivado de pedidos viejos y "copiar
 * avisos del grupo" en lote. Cada uno es, por sí solo, del tamaño de una
 * task — se recomienda una pasada separada si se necesitan.
 */

export type ItemPedido = { t: string; q: number; v?: string; c?: string };

export type Pedido = {
  id: string;
  user_id: string;
  numero: number | null;
  items: ItemPedido[];
  nombre: string | null;
  nota: string | null;
  telefono: string | null;
  created_at: string;
  actualizado_at?: string;
  estado: string;
  metodo_entrega: 'retiro' | 'envio';
  direccion: string | null;
  zona: string | null;
  zona_id: string | null;
  zona_nombre: string | null;
  costo_envio: number | null;
  franja_id: string | null;
  fecha_entrega: string | null;
  sucursal_id: string | null;
  sucursal_armado: string | null;
  entre_calles: string | null;
  piso_depto: string | null;
  receptor_nombre: string | null;
  receptor_telefono: string | null;
  bultos: 'chico' | 'mediano' | 'grande' | null;
  motivo_ausente: string | null;
  envio_inmediato?: boolean;
  archivado?: boolean;
};

export type PedidoEvento = {
  id: string;
  pedido_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  actor_email: string | null;
  motivo: string | null;
  created_at: string;
};

// La fecha se compara en horario LOCAL: toISOString() es UTC y desde las
// 21:00 de Argentina ya devuelve "mañana", marcando atrasos fantasma.
export function hoyLocalISO(ahora: Date = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${d}`;
}

export function esAtrasado(p: Pick<Pedido, 'fecha_entrega' | 'estado'>, hoy: string = hoyLocalISO()): boolean {
  return !!p.fecha_entrega && p.fecha_entrega < hoy && p.estado !== 'entregado' && p.estado !== 'cancelado';
}

export function diasAtraso(p: Pick<Pedido, 'fecha_entrega'>, hoy: string = hoyLocalISO()): number {
  if (!p.fecha_entrega) return 0;
  return Math.round((new Date(hoy + 'T00:00:00').getTime() - new Date(p.fecha_entrega + 'T00:00:00').getTime()) / 86400000);
}

// El traslado es "arma en el Centro, viaja a otra sucursal" — se reconoce
// por sucursal_armado <> sucursal_id, no por una bandera aparte. Sólo
// importa mientras el pedido todavía está en camino.
export function esTraslado(p: Pick<Pedido, 'metodo_entrega' | 'sucursal_id' | 'sucursal_armado' | 'estado'>): boolean {
  return p.metodo_entrega === 'retiro' && !!p.sucursal_id && !!p.sucursal_armado &&
    p.sucursal_armado !== p.sucursal_id &&
    (p.estado === 'en_preparacion' || p.estado === 'en_transito');
}

export function bultosDe(p: Pick<Pedido, 'bultos'>): number {
  return p.bultos === 'chico' ? 1 : p.bultos === 'mediano' ? 2 : p.bultos === 'grande' ? 3 : 1;
}

export type ModoAgrupar = 'fecha' | 'metodo' | 'zona' | 'estado';

// Modos simples (no incluye "plan"/"traslado", ver nota de alcance arriba).
export function claveGrupo(p: Pedido, modo: ModoAgrupar): string {
  if (modo === 'fecha') return p.fecha_entrega ? fechaLegible(p.fecha_entrega) : 'Sin fecha pedida';
  if (modo === 'metodo') return p.metodo_entrega === 'envio' ? 'Envío a domicilio' : 'Retiro en el local';
  if (modo === 'zona') {
    if (p.metodo_entrega !== 'envio') return 'Retiro en el local';
    return p.zona_nombre || p.zona || 'Envío sin zona indicada';
  }
  return ESTADOS_TXT[p.estado] || p.estado || 'Sin estado';
}

export function agruparPedidos(pedidos: Pedido[], modo: ModoAgrupar): { clave: string; pedidos: Pedido[] }[] {
  const orden: string[] = [];
  const grupos: Record<string, Pedido[]> = {};
  pedidos.forEach((p) => {
    const k = claveGrupo(p, modo);
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push(p);
  });
  return orden.map((clave) => ({ clave, pedidos: grupos[clave] }));
}

export type StatBadge = { valor: string; cantidad: number; etiqueta: string };

export function statsPorEstado(pedidos: Pedido[], estados: readonly string[]): StatBadge[] {
  const out: StatBadge[] = [{ valor: '', cantidad: pedidos.length, etiqueta: 'Todos' }];
  estados.forEach((e) => {
    out.push({ valor: e, cantidad: pedidos.filter((p) => p.estado === e).length, etiqueta: ESTADOS_TXT[e] || e });
  });
  const atrasados = pedidos.filter((p) => esAtrasado(p)).length;
  if (atrasados) out.push({ valor: '__atrasados', cantidad: atrasados, etiqueta: 'Atrasados' });
  return out;
}

export function filtrarPedidos(pedidos: Pedido[], filtroEstado: string): Pedido[] {
  if (filtroEstado === '__atrasados') return pedidos.filter((p) => esAtrasado(p));
  if (filtroEstado) return pedidos.filter((p) => p.estado === filtroEstado);
  return pedidos.slice();
}

// --- Mensajes de WhatsApp (plantillas por estado) -------------------------

export function resolverMensaje(p: Pedido, cuerpo: string, datosEnvios: DatosEnvios | null, sucursales: Sucursal[] = []): string {
  const suc = sucursales.find((s) => s.id === (p.sucursal_id || p.sucursal_armado)) || null;
  let franjaTxt = '';
  if (datosEnvios && p.franja_id && p.fecha_entrega) {
    const f = datosEnvios.franjas.find((x) => x.id === p.franja_id);
    if (f) franjaTxt = f.nombre;
  }
  const valores: Record<string, string> = {
    '{nombre}': p.nombre || '',
    '{numero}': p.numero != null ? String(p.numero) : '',
    '{fecha}': p.fecha_entrega ? fechaLegible(p.fecha_entrega) : '',
    '{franja}': franjaTxt,
    '{sucursal}': suc ? suc.nombre : '',
    '{zona}': p.zona_nombre || p.zona || '',
    '{costo_envio}': p.costo_envio ? plata(p.costo_envio) : '',
  };
  let out = cuerpo;
  Object.keys(valores).forEach((k) => { out = out.split(k).join(valores[k]); });
  return out;
}

// --- Fecha/franja de envío (sugerencia de cupo) ---------------------------
// El cliente ya no elige fecha/franja al pedir un envío (ver envio-form.js):
// llega en null y acá se sugiere y asigna la fecha real. Apunta a la
// ventana de 1 a 3 días hábiles prometida; si no hay cupo ahí, cae al
// primer día disponible dentro del horizonte configurado.
export async function sugerirFechaEnvio(sb: SupabaseClient, p: Pick<Pedido, 'zona_id'>, datos: DatosEnvios): Promise<string | null> {
  if (!p.zona_id) return null;
  const horizonte = datos.config.horizonte_dias || 14;
  const desde = hoyISO();
  const hasta = sumarDiasISO(desde, horizonte - 1);
  const dias = await cuposDisponibles(sb, desde, hasta, p.zona_id, null);
  const disponibles = dias.filter((d) => d.disponible);
  if (!disponibles.length) return null;
  const enVentana = disponibles.filter((d) => (new Date(d.fecha).getTime() - new Date(desde).getTime()) / 86400000 <= 3);
  return (enVentana[0] || disponibles[0]).fecha;
}

export function franjasDelPedido(datos: DatosEnvios, fecha: string) {
  return datos.franjas.filter((f) => f.dias_semana.includes(isodow(fecha)));
}

export function zonaDePedido(datos: DatosEnvios, p: Pick<Pedido, 'zona_id'>) {
  return zonaPorIdOSlug(datos.zonas, p.zona_id);
}

// --- Precio en vivo por ítem (Sprint C del dashboard admin) ---------------
// Un pedido nunca guardó precio (se confirma por WhatsApp, no hay checkout
// con pago real todavía) — se resuelve en vivo contra
// catalogo_precios_admin(), la misma fuente que actualiza el worker de
// Búho cada ~15 min, nunca un snapshot guardado en `pedidos`. Mismo
// criterio que resumen() de lib/carrito.ts: subtotal + cuántos ítems
// faltan, nunca un "Total" que sugiera estar completo si hay huecos.

export type FilaPrecioAdmin = { codigo: string; precio: number; stock: number | null };
export type MapaPreciosPedido = Record<string, { precio: number; stock: number | null }>;

export function codigosDelPedido(items: ItemPedido[]): string[] {
  return Array.from(new Set(items.map((it) => it.c).filter((c): c is string => !!c)));
}

export function mapaPreciosPedido(filas: FilaPrecioAdmin[]): MapaPreciosPedido {
  const mapa: MapaPreciosPedido = {};
  filas.forEach((f) => { mapa[f.codigo] = { precio: f.precio, stock: f.stock }; });
  return mapa;
}

export function precioItemPedido(it: ItemPedido, mapa: MapaPreciosPedido | null): number | null {
  if (!it.c || !mapa?.[it.c]) return null;
  return mapa[it.c].precio;
}

export type ResumenPrecioPedido = { suma: number; conPrecio: number; sinPrecio: number; completo: boolean };

export function resumenPrecioPedido(items: ItemPedido[], mapa: MapaPreciosPedido | null): ResumenPrecioPedido {
  let suma = 0, conPrecio = 0, sinPrecio = 0;
  items.forEach((it) => {
    const precio = precioItemPedido(it, mapa);
    if (precio != null) { suma += precio * it.q; conPrecio++; }
    else sinPrecio++;
  });
  return { suma, conPrecio, sinPrecio, completo: items.length > 0 && conPrecio > 0 && sinPrecio === 0 };
}
