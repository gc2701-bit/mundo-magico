import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatosEnvios } from './envios';
import { zonaPorIdOSlug, plata, franjasDelDia, franjaDelTurno, sumarDiasISO, horaActualHHMM, hoyISO, isodow, cuposDisponibles } from './envios';

/**
 * Formulario de entrega (nombre, retiro/envío, sucursal/zona, fecha/franja,
 * envío inmediato) — lógica pura, portada de public/assets/envio-form.js
 * (Sprint 5, Task 5.2). Mismas reglas de validación y mismo texto de
 * resumen para WhatsApp; la parte de DOM (chips, inputs) vive en el
 * componente React que consume este módulo.
 */

export type MetodoEntrega = 'retiro' | 'envio' | null;

export type EstadoEnvioForm = {
  nombre: string;
  metodo: MetodoEntrega;
  sucursalId: string | null;
  zonaId: string | null;
  direccion: string;
  entreCalles: string;
  pisoDepto: string;
  recibeOtra: boolean;
  receptorNombre: string;
  receptorTelefono: string;
  fecha: string; // yyyy-mm-dd
  franjaId: string | null;
  envioInmediato: boolean;
  turnoInmediato: { fecha: string; franjaId: string; franjaNombre: string } | null;
};

export function estadoInicial(): EstadoEnvioForm {
  return {
    nombre: '', metodo: null, sucursalId: null, zonaId: null, direccion: '', entreCalles: '', pisoDepto: '',
    recibeOtra: false, receptorNombre: '', receptorTelefono: '', fecha: '', franjaId: null,
    envioInmediato: false, turnoInmediato: null,
  };
}

export type DatosEntrega = {
  nombre: string;
  telefono: string;
  metodoEntrega: MetodoEntrega;
  sucursalId: string | null;
  sucursalNombre: string;
  zonaId: string | null;
  zonaNombre: string;
  direccion: string;
  entreCalles: string;
  pisoDepto: string;
  receptorNombre: string;
  receptorTelefono: string;
  fechaEntrega: string;
  franjaId: string | null;
  franjaNombre: string;
  envioInmediato: boolean;
  // Distinto de `envioInmediato`: éste es el checkbox tal cual está tildado,
  // aunque calcularProximoTurno() todavía no haya resuelto un turno (o haya
  // fallado). validar() lo necesita para diferenciar "tildó envío inmediato
  // y no hay turno" (error) de "envío normal, sin fecha porque la asigna el
  // negocio después" (válido) — las dos formas dejan `envioInmediato` en
  // false y `fechaEntrega` en ''.
  envioInmediatoIntentado: boolean;
  costoEnvio: number;
  entregaPropia: boolean;
};

function entregaPropiaDe(datos: DatosEnvios): boolean {
  return !!datos.config?.entrega_propia;
}

// Resuelve el estado "crudo" del formulario contra los datos de envíos
// (zonas/sucursales/franjas/config) — mismo criterio que leer() en
// envio-form.js: nunca confiar en un costo/nombre que venga del cliente,
// siempre recalculado acá desde MMEnvios/datos.
export function leerDatos(estado: EstadoEnvioForm, datos: DatosEnvios, telefono = ''): DatosEntrega {
  const z = zonaPorIdOSlug(datos.zonas, estado.zonaId);
  const suc = datos.sucursales.find((s) => s.id === estado.sucursalId) || null;
  const franja = estado.fecha ? datos.franjas.find((f) => f.id === estado.franjaId) || null : null;

  // Envío estándar (sin envío inmediato) no trae fecha/franja elegidas por
  // el cliente: las asigna el negocio al armar las rutas. El envío
  // inmediato es la excepción — ahí sí hay un turno concreto resuelto.
  const ocultarFecha = estado.metodo === 'envio' && !estado.envioInmediato;
  const propia = entregaPropiaDe(datos);

  let costoEnvio = 0;
  if (estado.metodo === 'envio' && propia) {
    const base = costoDeZona(datos, estado.zonaId);
    const extra = estado.envioInmediato && estado.turnoInmediato ? Number(datos.config.costo_envio_inmediato || 0) : 0;
    costoEnvio = base + extra;
  }

  return {
    nombre: estado.nombre.trim(),
    telefono,
    metodoEntrega: estado.metodo,
    sucursalId: estado.metodo === 'retiro' ? estado.sucursalId : null,
    sucursalNombre: estado.metodo === 'retiro' && suc ? suc.nombre : '',
    zonaId: estado.metodo === 'envio' ? estado.zonaId : null,
    zonaNombre: estado.metodo === 'envio' && z ? z.nombre : '',
    direccion: estado.metodo === 'envio' ? estado.direccion.trim() : '',
    entreCalles: estado.metodo === 'envio' ? estado.entreCalles.trim() : '',
    pisoDepto: estado.metodo === 'envio' ? estado.pisoDepto.trim() : '',
    receptorNombre: estado.metodo === 'envio' && estado.recibeOtra ? estado.receptorNombre.trim() : '',
    receptorTelefono: estado.metodo === 'envio' && estado.recibeOtra ? estado.receptorTelefono.trim() : '',
    fechaEntrega: ocultarFecha ? '' : estado.fecha || '',
    franjaId: ocultarFecha ? null : estado.franjaId,
    franjaNombre: ocultarFecha ? '' : franja ? franja.nombre : '',
    envioInmediato: estado.metodo === 'envio' && estado.envioInmediato && !!estado.turnoInmediato,
    envioInmediatoIntentado: estado.metodo === 'envio' && estado.envioInmediato,
    costoEnvio,
    entregaPropia: propia,
  };
}

function costoDeZona(datos: DatosEnvios, zonaId: string | null): number {
  const z = zonaPorIdOSlug(datos.zonas, zonaId);
  const t = z ? datos.tarifas.find((x) => x.id === z.tarifa_id) : null;
  return t ? Number(t.costo) : 0;
}

export type Validacion = { ok: true } | { ok: false; mensaje: string };

export function validar(d: DatosEntrega, datos: DatosEnvios): Validacion {
  if (!d.metodoEntrega) return { ok: false, mensaje: 'Elegí si retirás en el local o te lo enviamos a domicilio.' };
  if (d.metodoEntrega === 'retiro' && !d.sucursalId) return { ok: false, mensaje: 'Elegí en qué sucursal retirás.' };
  if (d.metodoEntrega === 'retiro' && !d.fechaEntrega) return { ok: false, mensaje: 'Elegí para cuándo lo necesitás.' };
  if (d.metodoEntrega === 'retiro' && !d.franjaId) return { ok: false, mensaje: 'Elegí la franja horaria.' };
  if (d.metodoEntrega === 'envio' && d.envioInmediatoIntentado && !d.fechaEntrega) {
    return { ok: false, mensaje: 'No encontramos un turno inmediato disponible — probá sin envío inmediato o escribinos por WhatsApp.' };
  }
  if (d.metodoEntrega === 'envio' && entregaPropiaDe(datos) && !d.zonaId) return { ok: false, mensaje: 'Elegí tu zona.' };
  if (d.metodoEntrega === 'envio' && !d.direccion) return { ok: false, mensaje: 'Falta la dirección de envío.' };
  return { ok: true };
}

// Texto (bold markdown de WhatsApp) para el bloque de entrega del mensaje —
// mismo texto que resumenTexto() de envio-form.js.
export function resumenTexto(d: DatosEntrega): string[] {
  const L: string[] = [];
  if (d.metodoEntrega === 'envio') {
    let linea = 'Envío';
    if (d.zonaNombre) linea += ' — ' + d.zonaNombre;
    if (d.direccion) linea += ' (' + d.direccion + ')';
    L.push('*Entrega:* ' + linea);
    if (d.entreCalles) L.push('*Entre calles:* ' + d.entreCalles);
    if (d.pisoDepto) L.push('*Piso/depto:* ' + d.pisoDepto);
    if (d.receptorNombre) L.push('*Lo recibe:* ' + d.receptorNombre + (d.receptorTelefono ? ' (' + d.receptorTelefono + ')' : ''));
    if (d.envioInmediato) L.push('*Envío inmediato:* sí, en el próximo turno disponible');
    if (d.costoEnvio) L.push('*Costo de envío:* ' + plata(d.costoEnvio) + ' (más el total de los productos)');
  } else {
    L.push('*Entrega:* Retiro en ' + (d.sucursalNombre || 'el local'));
  }
  if (d.metodoEntrega === 'envio' && !d.envioInmediato && !d.fechaEntrega) {
    L.push(d.entregaPropia
      ? '*Entrega estimada:* 1 a 3 días hábiles. Te confirmamos el día y el horario (de 9 a 13 o de 17 a 21) por WhatsApp.'
      : '*Envío:* lo coordina y paga el cliente (remis/Uber Moto/Uber Envíos) — retira en el local.');
  }
  if (d.fechaEntrega) L.push('*Para cuándo:* ' + fechaLegibleLocal(d.fechaEntrega));
  if (d.franjaNombre) L.push('*Franja:* ' + d.franjaNombre);
  return L;
}

function fechaLegibleLocal(iso: string): string {
  const p = iso.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export type Turno = { fecha: string; franjaId: string; franjaNombre: string } | null;

// Regla simple: si se pide antes de config.corte_inmediato_hora, el turno
// más cercano es la tarde de hoy; después del corte, la mañana de mañana.
// Si ese día no tiene franjas (domingo) o el corredor está lleno/bloqueado,
// se prueba el día siguiente hasta un tope — mismo criterio que
// calcularProximoTurno() en envio-form.js.
const MAX_INTENTOS_TURNO = 8;

export async function calcularProximoTurno(
  sb: SupabaseClient,
  datos: DatosEnvios,
  zonaId: string | null,
  ahora: Date = new Date()
): Promise<Turno> {
  const corte = String(datos.config.corte_inmediato_hora || '13:00:00').slice(0, 5);
  const antesDelCorte = horaActualHHMM(ahora) < corte;
  let fecha = antesDelCorte ? hoyISO(ahora) : sumarDiasISO(hoyISO(ahora), 1);
  let cual: 'primera' | 'ultima' = antesDelCorte ? 'ultima' : 'primera';

  for (let intento = 1; intento <= MAX_INTENTOS_TURNO; intento++) {
    const franja = franjaDelTurno(franjasDelDia(datos.franjas, isodow(fecha)), cual);
    if (!franja) {
      fecha = sumarDiasISO(fecha, 1);
      cual = 'primera';
      continue;
    }
    const dias = await cuposDisponibles(sb, fecha, fecha, zonaId, null, true);
    const info = dias[0];
    if (info && info.disponible) {
      return { fecha, franjaId: franja.id, franjaNombre: franja.nombre };
    }
    fecha = sumarDiasISO(fecha, 1);
    cual = 'primera';
  }
  return null;
}
