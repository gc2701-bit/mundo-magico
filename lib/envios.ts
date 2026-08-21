import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vocabulario y datos de envíos — portado de public/assets/envios.js
 * (Sprint 5, Task 5.2). Funciones puras (sin fetch) + un puñado de
 * funciones de I/O que hablan con Supabase (antes hablaban directo con
 * /rest/v1/ vía fetch con la anon key; acá se usa el mismo supabaseBrowser()
 * que el resto del sitio nuevo).
 *
 * Contrato defensivo igual que el original: si Supabase no responde, se cae
 * al RESPALDO (espejo de envios_01_config.sql) en vez de dejar el carrito
 * sin zonas para elegir. cupos() en particular: si falla, el llamador tiene
 * que tratarlo como "todo disponible", nunca como "todo bloqueado".
 */

export type Tarifa = { id: string; nombre: string; costo: number };
export type Zona = {
  id: string;
  slug?: string;
  nombre: string;
  descripcion?: string | null;
  grupo_ruta: string;
  orden_ruta?: number;
  tarifa_id: string;
  dias_semana?: number[];
  alias?: string[];
  lat?: number | null;
  lng?: number | null;
};
export type Franja = { id: string; nombre: string; hora_inicio: string; hora_fin: string; dias_semana: number[] };
export type Sucursal = { id: string; nombre: string; direccion?: string; es_deposito?: boolean; requiere_transferencia: boolean; microcentro?: boolean };
export type EnvioConfig = {
  lead_dias?: number;
  horizonte_dias: number;
  dias_fijos_activos?: boolean;
  cobrar_envio: boolean;
  minimo_compra: number;
  minutos_carga?: number;
  costo_envio_inmediato: number;
  corte_inmediato_hora: string;
  entrega_propia: boolean;
};
export type DatosEnvios = { tarifas: Tarifa[]; zonas: Zona[]; franjas: Franja[]; sucursales: Sucursal[]; config: EnvioConfig };
export type DiaCupo = { fecha: string; disponible: boolean; motivo?: string | null };

const CORREDOR_TXT: Record<string, string> = { centro: 'Centro', oeste: 'Oeste', norte: 'Norte', este: 'Este', sur: 'Sur' };

export const MOTIVO_TXT: Record<string, string> = {
  pasada: 'Esa fecha ya pasó.',
  domingo: 'Los domingos el local está cerrado.',
  sin_anticipacion: 'Necesitamos un poco más de anticipación para esa fecha.',
  fuera_de_horizonte: 'Todavía no tomamos pedidos tan a futuro por acá — escribinos y lo coordinamos igual.',
  zona_no_reparte_ese_dia: 'Esta zona no tiene reparto ese día.',
  bloqueada: 'Ese día no hay reparto (feriado o aviso especial).',
  cupo_pedidos: 'Se llenaron los pedidos de esa fecha.',
  cupo_bultos: 'Se llenó la capacidad de esa fecha.',
};

export function nombreCorredor(grupo: string): string {
  return CORREDOR_TXT[grupo] || grupo;
}

// Vocabulario de estados de pedido — usado por el panel de administración
// (Sprint 5, Task 5.3) y por el historial de pedidos del cliente
// (lib/cuenta.ts tiene un subconjunto más chico, sólo lo que el cliente ve).
export const ESTADOS = [
  'nuevo', 'confirmado', 'en_preparacion', 'en_transito', 'listo',
  'en_reparto', 'entregado', 'ausente', 'reprogramado', 'cancelado',
] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADOS_TXT: Record<string, string> = {
  nuevo: 'Nuevo',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  en_transito: 'En viaje a Yerba Buena',
  listo: 'Listo',
  en_reparto: 'En reparto',
  entregado: 'Entregado',
  ausente: 'No había nadie',
  reprogramado: 'Reprogramado',
  cancelado: 'Cancelado',
};

export const MOTIVOS_AUSENTE = ['nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo', 'zona_inundada', 'vehiculo', 'otro'] as const;
export const MOTIVOS_AUSENTE_TXT: Record<string, string> = {
  nadie_en_domicilio: 'No había nadie en el domicilio',
  direccion_inexistente: 'La dirección no existe o no se encontró',
  cliente_reprogramo: 'El cliente pidió reprogramar',
  zona_inundada: 'Zona inundada / no se pudo llegar',
  vehiculo: 'Problema con el vehículo',
  otro: 'Otro motivo',
};

// `en_transito` sólo aplica a un retiro en una sucursal que requiere
// traslado (hoy, Yerba Buena); `en_reparto` sólo a un envío. `metodo` y
// `sucursalId` desambiguan esas dos ramas.
export function siguientes(estado: string, metodo: string | null | undefined, sucursalId: string | null | undefined, sucursales: Sucursal[] = []): string[] {
  const transferencia = sucursalId ? !!sucursales.find((s) => s.id === sucursalId)?.requiere_transferencia : false;
  switch (estado) {
    case 'nuevo': return ['confirmado', 'cancelado'];
    case 'confirmado': return ['en_preparacion', 'cancelado'];
    case 'en_preparacion':
      return metodo === 'retiro' && transferencia ? ['en_transito', 'cancelado'] : ['listo', 'cancelado'];
    case 'en_transito': return ['listo', 'cancelado'];
    case 'listo': return metodo === 'envio' ? ['en_reparto', 'cancelado'] : ['entregado', 'cancelado'];
    case 'en_reparto': return ['entregado', 'ausente', 'cancelado'];
    case 'ausente': return ['reprogramado', 'cancelado'];
    case 'reprogramado': return ['listo', 'cancelado'];
    default: return [];
  }
}

// Normaliza un teléfono argentino escrito de cualquier forma al formato que
// espera wa.me: 549 + característico + número, sin 0 ni 15.
export function telWa(txt: string | null | undefined): string {
  let d = String(txt || '').replace(/\D/g, '');
  d = d.replace(/^54/, '');
  d = d.replace(/^9/, '');
  d = d.replace(/^0/, '');
  d = d.replace(/^(\d{2,4})15/, '$1');
  return '549' + d;
}

// Respaldo si Supabase no responde — espeja el seed de envios_01_config.sql.
export const RESPALDO: DatosEnvios = {
  tarifas: [
    { id: 'capital', nombre: 'Capital', costo: 2000 },
    { id: 'cercano', nombre: 'Cercano', costo: 3500 },
    { id: 'lejano', nombre: 'Lejano', costo: 5500 },
  ],
  zonas: [
    { id: 'smt-microcentro', slug: 'smt-microcentro', nombre: 'Microcentro', descripcion: 'Dentro del perímetro del estacionamiento medido', grupo_ruta: 'centro', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8252, lng: -65.2251 },
    { id: 'smt-oeste', slug: 'smt-oeste', nombre: 'San Miguel — Oeste', descripcion: 'Eje Av. Mate de Luna / Aconquija', grupo_ruta: 'oeste', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8279, lng: -65.2203 },
    { id: 'cevil-redondo', slug: 'cevil-redondo', nombre: 'Cevil Redondo', descripcion: null, grupo_ruta: 'oeste', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Cevil Redondo'], lat: -26.8002, lng: -65.2600 },
    { id: 'yerba-buena', slug: 'yerba-buena', nombre: 'Yerba Buena', descripcion: 'Contigua al oeste de la capital', grupo_ruta: 'oeste', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Yerba Buena'], lat: -26.8216, lng: -65.3045 },
    { id: 'smt-norte', slug: 'smt-norte', nombre: 'San Miguel — Norte', descripcion: 'Al norte de Av. Sarmiento / Ejército del Norte', grupo_ruta: 'norte', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8144, lng: -65.2299 },
    { id: 'las-talitas', slug: 'las-talitas', nombre: 'Las Talitas', descripcion: null, grupo_ruta: 'norte', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.7899, lng: -65.1897 },
    { id: 'tafi-viejo', slug: 'tafi-viejo', nombre: 'Tafí Viejo', descripcion: null, grupo_ruta: 'norte', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.7362, lng: -65.2576 },
    { id: 'smt-este', slug: 'smt-este', nombre: 'San Miguel — Este', descripcion: 'Eje Av. Alem, hacia el río', grupo_ruta: 'este', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8404, lng: -65.2214 },
    { id: 'banda-del-rio-sali', slug: 'banda-del-rio-sali', nombre: 'Banda del Río Salí', descripcion: 'Cruzando el río hacia el este', grupo_ruta: 'este', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Banda del Río Salí'], lat: -26.8386, lng: -65.1658 },
    { id: 'alderetes', slug: 'alderetes', nombre: 'Alderetes', descripcion: null, grupo_ruta: 'este', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8224, lng: -65.1441 },
    { id: 'smt-sur', slug: 'smt-sur', nombre: 'San Miguel — Sur', descripcion: 'Al sur de Av. Roca', grupo_ruta: 'sur', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8424, lng: -65.2125 },
    { id: 'el-manantial', slug: 'el-manantial', nombre: 'El Manantial', descripcion: null, grupo_ruta: 'sur', orden_ruta: 2, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8479, lng: -65.2826 },
    { id: 'san-pablo', slug: 'san-pablo', nombre: 'San Pablo', descripcion: null, grupo_ruta: 'sur', orden_ruta: 3, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['San Pablo'], lat: -26.8795, lng: -65.3138 },
    { id: 'lules', slug: 'lules', nombre: 'Lules', descripcion: 'La más lejana al sur', grupo_ruta: 'sur', orden_ruta: 4, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Lules'], lat: -26.9254, lng: -65.3372 },
  ],
  franjas: [
    { id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] },
    { id: 'tarde', nombre: 'Tarde', hora_inicio: '17:00', hora_fin: '21:00', dias_semana: [1, 2, 3, 4, 5] },
    { id: 'sabado', nombre: 'Sábado', hora_inicio: '09:00', hora_fin: '13:30', dias_semana: [6] },
  ],
  sucursales: [
    { id: 'junin-351', nombre: 'Junín 351', direccion: 'Junín 351, San Miguel de Tucumán', es_deposito: true, requiere_transferencia: false, microcentro: true },
    { id: 'junin-241', nombre: 'Junín 241', direccion: 'Junín 241, San Miguel de Tucumán', es_deposito: false, requiere_transferencia: false, microcentro: true },
    { id: 'cordoba-784', nombre: 'Córdoba 784', direccion: 'Córdoba 784, San Miguel de Tucumán', es_deposito: false, requiere_transferencia: false, microcentro: true },
    { id: 'solano-vera-510', nombre: 'Solano Vera 510', direccion: 'Solano Vera 510, Yerba Buena', es_deposito: false, requiere_transferencia: true, microcentro: false },
  ],
  config: { lead_dias: 1, horizonte_dias: 14, dias_fijos_activos: false, cobrar_envio: true, minimo_compra: 0, minutos_carga: 30, costo_envio_inmediato: 0, corte_inmediato_hora: '13:00:00', entrega_propia: false },
};

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export function plata(n: number): string {
  return fmt.format(Number(n) || 0);
}

export function zonaPorIdOSlug(zonas: Zona[], idOSlug: string | null | undefined): Zona | null {
  if (!idOSlug) return null;
  return zonas.find((z) => z.id === idOSlug || z.slug === idOSlug) || null;
}

export function tarifaDe(tarifas: Tarifa[], tarifaId: string | null | undefined): Tarifa | null {
  if (!tarifaId) return null;
  return tarifas.find((t) => t.id === tarifaId) || null;
}

export function costoDe(datos: DatosEnvios, zonaId: string | null | undefined): number {
  const z = zonaPorIdOSlug(datos.zonas, zonaId);
  const t = z ? tarifaDe(datos.tarifas, z.tarifa_id) : null;
  return t ? Number(t.costo) : 0;
}

export function franjasDelDia(franjas: Franja[], isodow: number): Franja[] {
  return franjas.filter((f) => (f.dias_semana || []).includes(isodow));
}

export function franjaDelTurno(franjasDia: Franja[], cual: 'primera' | 'ultima'): Franja | null {
  if (!franjasDia.length) return null;
  const ordenadas = [...franjasDia].sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  return cual === 'ultima' ? ordenadas[ordenadas.length - 1] : ordenadas[0];
}

// "yyyy-mm-dd" → "dd/mm/aaaa" a mano: `new Date(iso)` interpreta la fecha en
// UTC y en husos horarios negativos (como Argentina) puede mostrar el día
// anterior.
export function fechaLegible(iso: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function hoyISO(ahora: Date = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${day}`;
}

// Postgres isodow: 1=lunes…7=domingo. JS Date#getDay: 0=domingo…6=sábado.
export function isodow(iso: string): number {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return ((d.getDay() + 6) % 7) + 1;
}

export function sumarDiasISO(iso: string, n: number): string {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function horaActualHHMM(ahora: Date = new Date()): string {
  const h = String(ahora.getHours()).padStart(2, '0');
  const m = String(ahora.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const MES_CORTO = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function mesCorto(mm: string): string {
  return MES_CORTO[Number(mm)] || '';
}

// Distancia entre dos puntos (fórmula de Haversine), en km.
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Respaldo permisivo si cupos() falla: todo disponible salvo domingo. Nunca
// hay que traducir "no pude preguntarle al servidor" en "no hay cupo".
export function permisivo(desde: string, hasta: string): DiaCupo[] {
  const out: DiaCupo[] = [];
  const d0 = desde.split('-');
  const cur = new Date(Number(d0[0]), Number(d0[1]) - 1, Number(d0[2]));
  const f0 = hasta.split('-');
  const lim = new Date(Number(f0[0]), Number(f0[1]) - 1, Number(f0[2]));
  while (cur <= lim) {
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    const isoFecha = `${cur.getFullYear()}-${m}-${day}`;
    const dow = ((cur.getDay() + 6) % 7) + 1;
    out.push({ fecha: isoFecha, disponible: dow !== 7, motivo: dow === 7 ? 'domingo' : null });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const CACHE_KEY = 'mm_envios_cache_v1';
const CACHE_MS = 30 * 60 * 1000;

function leerCache(storage: Pick<Storage, 'getItem'>): DatosEnvios | null {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.t || Date.now() - o.t > CACHE_MS) return null;
    return o.data;
  } catch {
    return null;
  }
}

function guardarCache(storage: Pick<Storage, 'setItem'>, data: DatosEnvios): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* sessionStorage lleno o no disponible: seguir sin cachear */
  }
}

// Trae tarifas/zonas/franjas/sucursales/config desde Supabase, con cache en
// sessionStorage (30 min) y caída a RESPALDO si algo falla.
export async function cargarEnvios(
  sb: SupabaseClient,
  storage: Pick<Storage, 'getItem' | 'setItem'> = typeof sessionStorage !== 'undefined' ? sessionStorage : { getItem: () => null, setItem: () => {} }
): Promise<DatosEnvios> {
  const cacheado = leerCache(storage);
  if (cacheado) return cacheado;

  try {
    const [tarifas, zonas, franjas, sucursales, config] = await Promise.all([
      sb.from('envio_tarifas').select('*').order('orden', { ascending: true }),
      sb.from('envio_zonas').select('*').order('grupo_ruta', { ascending: true }).order('orden_ruta', { ascending: true }).eq('activa', true),
      sb.from('envio_franjas').select('*').order('orden', { ascending: true }).eq('activa', true),
      sb.from('sucursales').select('*').eq('activa', true),
      sb.from('envio_config').select('*').eq('id', 1),
    ]);
    if (tarifas.error || zonas.error || franjas.error || sucursales.error) throw new Error('envios: fetch falló');
    const datos: DatosEnvios = {
      tarifas: tarifas.data || [],
      zonas: zonas.data || [],
      franjas: franjas.data || [],
      sucursales: sucursales.data || [],
      config: config.data && config.data[0] ? config.data[0] : RESPALDO.config,
    };
    guardarCache(storage, datos);
    return datos;
  } catch {
    return RESPALDO;
  }
}

// RPC del servidor. Si falla, cae al respaldo permisivo — nunca hay que
// convertir "no pude preguntarle al servidor" en "todo bloqueado".
export async function cuposDisponibles(
  sb: SupabaseClient,
  desde: string,
  hasta: string,
  zonaId: string | null,
  sucursalId: string | null = null,
  ignorarAnticipacion = false
): Promise<DiaCupo[]> {
  try {
    const r = await sb.rpc('cupos_disponibles', {
      p_desde: desde,
      p_hasta: hasta,
      p_zona_id: zonaId,
      p_sucursal_id: sucursalId,
      p_ignorar_anticipacion: ignorarAnticipacion,
    });
    if (r.error || !r.data) throw r.error || new Error('sin datos');
    return r.data as DiaCupo[];
  } catch {
    return permisivo(desde, hasta);
  }
}
