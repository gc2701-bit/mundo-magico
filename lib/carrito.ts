import type { SupabaseClient } from '@supabase/supabase-js';
import { plata as formatoPlata } from './envios';

/**
 * Carrito de pedidos → WhatsApp — lógica pura, portada de
 * public/assets/carrito.js (Sprint 5, Task 5.2). Mismo `localStorage` key
 * (`mm_carrito_v2`) y misma forma de renglón que el sitio viejo, para que un
 * pedido a medio armar sobreviva al corte a Next.js.
 *
 * La unidad del pedido es la VARIANTE (título + talle), no el producto —
 * ver el mismo criterio en el comentario de cabecera de carrito.js.
 */

export type ItemCarrito = { title: string; variant: string; code: string; img: string; qty: number };
export type PreciosMapa = Record<string, number>;

const LS = 'mm_carrito_v2';
export const MAX_ITEMS = 40;

export function claveItem(it: Pick<ItemCarrito, 'code' | 'title' | 'variant'>): string {
  return `${it.code || ''}::${it.title}::${it.variant || ''}`;
}

export function cargarCarrito(storage: Pick<Storage, 'getItem'> = localStorage): ItemCarrito[] {
  try {
    const raw = storage.getItem(LS);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function guardarCarrito(items: ItemCarrito[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(LS, JSON.stringify(items));
  } catch {
    /* modo privado */
  }
}

export function itemPorClave(items: ItemCarrito[], clave: string): ItemCarrito | null {
  return items.find((x) => claveItem(x) === clave) || null;
}

export function cantidadDe(items: ItemCarrito[], prod: { title: string; variant?: string; code: string }): number {
  const it = items.find((x) => claveItem(x) === claveItem({ code: prod.code, title: prod.title, variant: prod.variant || '' }));
  return it ? it.qty : 0;
}

// Todo lo pedido de este producto, sumando sus talles/opciones — es lo que
// muestra el botón de una tarjeta con opciones, donde no hay una cantidad
// única (mismo criterio que cantidadTotal() en carrito.js).
export function cantidadTotalDe(items: ItemCarrito[], title: string): number {
  return items.reduce((n, x) => (x.title === title ? n + x.qty : n), 0);
}

export type ResultadoPonerCantidad = { items: ItemCarrito[]; ok: boolean; motivo?: 'max_items' };

// Pura: no toca localStorage — el caller (React) decide cuándo persistir.
export function ponerCantidad(
  items: ItemCarrito[],
  prod: { title: string; variant?: string; code: string; img?: string },
  n: number,
  maxItems: number = MAX_ITEMS
): ResultadoPonerCantidad {
  const clave = claveItem({ code: prod.code, title: prod.title, variant: prod.variant || '' });
  const idx = items.findIndex((x) => claveItem(x) === clave);

  if (n <= 0) {
    if (idx === -1) return { items, ok: true };
    return { items: items.filter((_, i) => i !== idx), ok: true };
  }
  if (idx !== -1) {
    const siguiente = items.slice();
    siguiente[idx] = { ...siguiente[idx], qty: n };
    return { items: siguiente, ok: true };
  }
  if (items.length >= maxItems) return { items, ok: false, motivo: 'max_items' };
  return {
    items: [...items, { title: prod.title, variant: prod.variant || '', code: prod.code, img: prod.img || '', qty: n }],
    ok: true,
  };
}

export function quitarItem(items: ItemCarrito[], clave: string): ItemCarrito[] {
  return items.filter((x) => claveItem(x) !== clave);
}

export function precioUnidad(it: Pick<ItemCarrito, 'code'>, precios: PreciosMapa | null): number {
  if (!precios || !it.code) return 0;
  return precios[it.code] || 0;
}

export type Resumen = { suma: number; conPrecio: number; sinPrecio: number; hayPrecios: boolean; completo: boolean };

// Con renglones sin precio, "Total" pasaría por un número que el cliente
// leería como definitivo y no lo es — por eso se distingue "Subtotal" +
// cuántos faltan (mismo criterio que resumen()/pintarTotal() en carrito.js).
export function resumen(items: ItemCarrito[], precios: PreciosMapa | null): Resumen {
  let suma = 0, conPrecio = 0, sinPrecio = 0;
  items.forEach((it) => {
    const u = precioUnidad(it, precios);
    if (u > 0) { suma += u * it.qty; conPrecio++; }
    else sinPrecio++;
  });
  return { suma, conPrecio, sinPrecio, hayPrecios: !!precios, completo: conPrecio > 0 && sinPrecio === 0 };
}

export { formatoPlata };

// --- Codificación del link "Ver pedido completo" / pedido.html -----------

export function base64url(str: string): string {
  const b = typeof window !== 'undefined' && window.btoa ? window.btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, 'utf-8').toString('base64');
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(h: string): unknown {
  let b = h.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const str = typeof window !== 'undefined' && window.atob ? decodeURIComponent(escape(window.atob(b))) : Buffer.from(b, 'base64').toString('utf-8');
  return JSON.parse(str);
}

export type EntregaPedido = Record<string, unknown>;
export type ItemPedidoLink = { t: string; q: number; v?: string; c?: string; i?: string };

export function itemsParaLink(items: ItemCarrito[]): ItemPedidoLink[] {
  return items.map((it) => {
    const o: ItemPedidoLink = { t: it.title, q: it.qty };
    if (it.variant) o.v = it.variant;
    if (it.code) o.c = it.code;
    if (it.img) o.i = it.img;
    return o;
  });
}

// Mismo formato que urlPedido() de carrito.js: {i, e} si hay datos de
// entrega (E3+), o el array pelado si no (compatibilidad con links viejos).
export function urlPedido(opts: {
  items: ItemCarrito[];
  entrega?: EntregaPedido | null;
  vistaCliente?: boolean;
  baseUrl: string; // origin + pathname del sitio, terminado en '/'
}): string {
  const lista = itemsParaLink(opts.items);
  const payload = opts.entrega ? { i: lista, e: opts.entrega } : lista;
  const qs = opts.vistaCliente ? '?vista=cliente' : '';
  const base = opts.baseUrl.endsWith('/') ? opts.baseUrl : opts.baseUrl + '/';
  return `${base}pedido${qs}#${base64url(JSON.stringify(payload))}`;
}

export function waLink(mensaje: string, numero: string = '5493813006343'): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

// --- Armado del mensaje de WhatsApp ---------------------------------------
// `entregaLineas` viaja ya armado (bold markdown de WhatsApp) por quien
// arma la entrega — mismo texto que resumenTexto() de envio-form.js
// (ver lib/envio-form-logic.ts), para no duplicar esas reglas acá.
export function construirMensaje(opts: {
  items: ItemCarrito[];
  precios: PreciosMapa | null;
  nombre?: string;
  entregaLineas: string[];
  nota?: string;
  link?: string | null;
}): string {
  const L: string[] = [];
  L.push('*Pedido desde la web* — Mundo Mágico');
  L.push('');
  opts.items.forEach((it) => {
    let linea = `• ${it.qty}x `;
    if (it.code) linea += `[${it.code}] `;
    linea += it.title;
    if (it.variant) linea += ` — ${it.variant}`;
    const u = precioUnidad(it, opts.precios);
    if (u > 0) linea += ` — ${formatoPlata(u * it.qty)}`;
    L.push(linea);
  });
  L.push('');

  const res = resumen(opts.items, opts.precios);
  if (res.hayPrecios && res.conPrecio) {
    L.push((res.completo ? '*Total:* ' : '*Subtotal:* ') + formatoPlata(res.suma) + (res.completo ? '' : ` (${res.sinPrecio} sin precio)`));
    L.push('');
  }

  if (opts.nombre) L.push('*Nombre:* ' + opts.nombre);
  L.push(...opts.entregaLineas);
  if (opts.nota) L.push('*Comentario:* ' + opts.nota);

  if (opts.link) { L.push(''); L.push('Ver el pedido con fotos: ' + opts.link); }

  L.push('');
  L.push('_Enviado desde la web. Espero confirmación de disponibilidad y total._');

  return L.join('\n');
}

// --- Guardar copia en el historial de pedidos (Perfil → Mis pedidos / admin) ---
// No bloquea el envío por WhatsApp si falla — ver mismo criterio en
// carrito.js `enviarAhora()`. El caller decide si llamar esto (sólo con
// sesión activa).
export type FilaPedido = {
  user_id: string;
  items: ItemPedidoLink[];
  nombre: string;
  entrega?: string;
  nota: string;
  metodo_entrega: string;
  direccion: string;
  zona: string;
  telefono?: string;
  zona_id?: string | null;
  zona_nombre?: string;
  costo_envio?: number;
  franja_id?: string | null;
  sucursal_id?: string | null;
  fecha_entrega?: string | null;
  entre_calles?: string;
  piso_depto?: string;
  receptor_nombre?: string;
  receptor_telefono?: string;
};

export async function guardarPedido(sb: SupabaseClient, fila: FilaPedido): Promise<boolean> {
  try {
    const { error } = await sb.from('pedidos').insert(fila);
    return !error;
  } catch {
    return false;
  }
}
