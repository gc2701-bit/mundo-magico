import { base64urlDecode } from './carrito';

/**
 * Visor de un pedido compartido por link (app/pedido/page.tsx) — portado de
 * pedido.html (Sprint 5, Task 5.2). El pedido NO está guardado en ningún
 * lado: viaja codificado en el `#` del link. Lógica pura de parseo/armado de
 * líneas; el componente sólo la usa para dibujar con `textContent`/JSX
 * (nunca `dangerouslySetInnerHTML` — el pedido llega del lado del cliente).
 */

export type ItemPedido = { t: string; q: number; v?: string; c?: string; i?: string };
export type EntregaPedido = {
  nombre?: string;
  telefono?: string;
  metodoEntrega?: 'retiro' | 'envio';
  zonaNombre?: string;
  direccion?: string;
  entreCalles?: string;
  pisoDepto?: string;
  receptorNombre?: string;
  receptorTelefono?: string;
  costoEnvio?: number;
  entregaPropia?: boolean;
  fechaEntrega?: string;
  franjaNombre?: string;
  sucursalNombre?: string;
  bultos?: string;
};

export function decodificarPedido(hash: string): { items: ItemPedido[]; entrega: EntregaPedido | null } | null {
  let crudo: unknown;
  try {
    crudo = base64urlDecode(hash);
  } catch {
    return null;
  }

  // Formato viejo: array pelado de items. Formato nuevo (E3+): {i, e}.
  let items: ItemPedido[] | null = null;
  let entrega: EntregaPedido | null = null;
  if (Array.isArray(crudo)) {
    items = crudo;
  } else if (crudo && typeof crudo === 'object' && Array.isArray((crudo as { i?: unknown }).i)) {
    items = (crudo as { i: ItemPedido[] }).i;
    entrega = (crudo as { e?: EntregaPedido }).e || null;
  }

  if (!items || !items.length) return null;
  return { items, entrega };
}

// Sólo rutas relativas al catálogo: nada de http://, //otro-sitio ni
// javascript:/data: — el pedido llega del lado del cliente y un link editado
// a mano no debe poder cargar nada de otro origen.
export function fotoSegura(src: unknown): string {
  if (typeof src !== 'string' || !src) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.indexOf('//') === 0) return '';
  if (src.indexOf('..') !== -1) return '';
  return src;
}

export type ResumenPedido = { unidades: number; renglones: number; sinCodigo: number };

export function resumenPedido(items: ItemPedido[]): ResumenPedido {
  let unidades = 0, renglones = 0, sinCodigo = 0;
  items.forEach((it) => {
    const q = Number.isFinite(Number(it.q)) && Number(it.q) > 0 ? Number(it.q) : 1;
    unidades += q;
    renglones++;
    if (!it.c) sinCodigo++;
  });
  return { unidades, renglones, sinCodigo };
}

function reformatearFecha(iso: string): string {
  return iso.split('-').reverse().join('/');
}

// Líneas de texto plano para el bloque "Entrega" del visor (no lleva markdown
// de WhatsApp, a diferencia de resumenTexto() de envio-form.js).
export function lineasEntrega(entrega: EntregaPedido): string[] {
  const L: string[] = [];
  if (entrega.nombre) L.push('Nombre: ' + entrega.nombre);
  if (entrega.telefono) L.push('Teléfono: ' + entrega.telefono);

  if (entrega.metodoEntrega === 'envio') {
    L.push('Envío a ' + (entrega.zonaNombre || 'zona sin especificar') + (entrega.direccion ? ' — ' + entrega.direccion : ''));
    if (entrega.entreCalles) L.push('Entre calles: ' + entrega.entreCalles);
    if (entrega.pisoDepto) L.push('Piso/depto: ' + entrega.pisoDepto);
    if (entrega.receptorNombre) {
      L.push('Lo recibe: ' + entrega.receptorNombre + (entrega.receptorTelefono ? ' (' + entrega.receptorTelefono + ')' : ''));
    }
    if (entrega.costoEnvio) L.push(`Costo de envío: $${entrega.costoEnvio} (más el total de los productos)`);
    if (!entrega.fechaEntrega) {
      // Ausente en links viejos, de antes de este campo: se asume true (el
      // comportamiento que tenían en ese momento) — mismo criterio que
      // pedido.html.
      L.push(entrega.entregaPropia !== false
        ? 'Entrega estimada: 1 a 3 días hábiles (te confirmamos el día y el horario por WhatsApp — de 9 a 13 o de 17 a 21)'
        : 'Envío: lo coordina y paga el cliente (remis/Uber Moto/Uber Envíos) — retira en el local.');
    }
  } else {
    L.push('Retiro en ' + (entrega.sucursalNombre || 'el local'));
  }

  if (entrega.fechaEntrega) L.push('Para cuándo: ' + reformatearFecha(entrega.fechaEntrega));
  if (entrega.franjaNombre) L.push('Franja: ' + entrega.franjaNombre);
  if (entrega.bultos) L.push('Tamaño del pedido: ' + entrega.bultos);

  return L;
}

// Bloque "Para confirmar" — sólo para quien atiende el WhatsApp del negocio,
// nunca para el cliente (ver ?vista=cliente en app/pedido/page.tsx).
export function lineasParaConfirmar(sinCodigo: number): string[] {
  return [
    'Buscá cada código en el sistema y verificá que haya stock en algún local.',
    'Respondele al cliente por el mismo chat con el total y la forma de pago.',
    sinCodigo
      ? `${sinCodigo} producto(s) vinieron sin código: buscalos por nombre en el sistema.`
      : 'Todos los productos vinieron con código de sistema.',
  ];
}
