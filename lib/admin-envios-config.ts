/**
 * Editor de configuración de envíos (Sprint 5, Task 5.4) — lógica pura,
 * portada de public/assets/admin-envios.js. Ocho tablas (zonas, tarifas,
 * franjas, sucursales, cupos, bloqueos, repartidores, mensajes), todas
 * dibujadas por un único editor genérico manejado por metadatos (TABLAS) —
 * no hay una pantalla a medida por tabla, ni acá ni en el original.
 *
 * `sb.rpc('es_admin')` en el gate es sólo para decidir si DIBUJAR el
 * editor — la barrera real son las políticas RLS de cada tabla (ver
 * supabase/envios_01_config.sql): sin permiso, cada "Guardar" daría 403
 * igual, este chequeo sólo evita mostrar un editor inservible.
 */

export type TipoColumna =
  | 'texto' | 'numero' | 'select' | 'select_tarifa' | 'parrafo'
  | 'hora' | 'fecha' | 'bool' | 'lista_numeros' | 'lista_texto';

export type ColumnaDef = {
  campo: string;
  label: string;
  tipo: TipoColumna;
  opciones?: string[];
  nullable?: boolean;
  soloLectura?: boolean;
};

export type TablaDef = {
  tabla: string;
  titulo: string;
  orden: string; // "col.asc,col2.desc" — mismo formato que usaba PostgREST a mano
  clave?: string; // default 'id'
  permiteNuevo?: boolean;
  permiteBorrar?: boolean;
  columnas: ColumnaDef[];
};

const CORREDORES = ['centro', 'oeste', 'norte', 'este', 'sur'];

export const TABLAS: Record<string, TablaDef> = {
  zonas: {
    tabla: 'envio_zonas', titulo: 'Zonas', orden: 'grupo_ruta.asc,orden_ruta.asc',
    columnas: [
      { campo: 'slug', label: 'Slug', tipo: 'texto', soloLectura: true },
      { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
      { campo: 'descripcion', label: 'Descripción', tipo: 'texto', nullable: true },
      { campo: 'grupo_ruta', label: 'Corredor', tipo: 'select', opciones: CORREDORES },
      { campo: 'orden_ruta', label: 'Orden', tipo: 'numero' },
      { campo: 'tarifa_id', label: 'Tarifa', tipo: 'select_tarifa' },
      { campo: 'km_centro', label: 'Km al centro', tipo: 'numero', nullable: true },
      { campo: 'lat', label: 'Latitud (centro de la zona)', tipo: 'numero', nullable: true },
      { campo: 'lng', label: 'Longitud (centro de la zona)', tipo: 'numero', nullable: true },
      { campo: 'dias_semana', label: 'Días (1-7, coma)', tipo: 'lista_numeros' },
      { campo: 'alias', label: 'Alias (texto viejo, coma)', tipo: 'lista_texto' },
      { campo: 'activa', label: 'Activa', tipo: 'bool' },
    ],
  },
  tarifas: {
    tabla: 'envio_tarifas', titulo: 'Tarifas', orden: 'orden.asc',
    columnas: [
      { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
      { campo: 'costo', label: 'Costo ($)', tipo: 'numero' },
      { campo: 'orden', label: 'Orden', tipo: 'numero' },
      { campo: 'activa', label: 'Activa', tipo: 'bool' },
    ],
  },
  franjas: {
    tabla: 'envio_franjas', titulo: 'Franjas', orden: 'orden.asc',
    columnas: [
      { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
      { campo: 'hora_inicio', label: 'Desde', tipo: 'hora' },
      { campo: 'hora_fin', label: 'Hasta', tipo: 'hora' },
      { campo: 'dias_semana', label: 'Días (1-7, coma)', tipo: 'lista_numeros' },
      { campo: 'orden', label: 'Orden', tipo: 'numero' },
      { campo: 'activa', label: 'Activa', tipo: 'bool' },
    ],
  },
  sucursales: {
    tabla: 'sucursales', titulo: 'Sucursales', orden: 'nombre.asc',
    columnas: [
      { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
      { campo: 'direccion', label: 'Dirección', tipo: 'texto' },
      { campo: 'es_deposito', label: 'Es depósito', tipo: 'bool' },
      { campo: 'requiere_transferencia', label: 'Requiere traslado', tipo: 'bool' },
      { campo: 'microcentro', label: 'Microcentro', tipo: 'bool' },
      { campo: 'carga_hasta', label: 'Carga hasta', tipo: 'hora', nullable: true },
      { campo: 'activa', label: 'Activa', tipo: 'bool' },
    ],
  },
  cupos: {
    tabla: 'envio_cupos', titulo: 'Cupos', orden: 'grupo_ruta.asc,dia_semana.asc',
    columnas: [
      { campo: 'grupo_ruta', label: 'Corredor', tipo: 'texto', soloLectura: true },
      { campo: 'dia_semana', label: 'Día (1=lun…7=dom)', tipo: 'numero', soloLectura: true },
      { campo: 'cupo_pedidos', label: 'Cupo pedidos', tipo: 'numero' },
      { campo: 'cupo_bultos', label: 'Cupo bultos', tipo: 'numero' },
    ],
  },
  bloqueos: {
    tabla: 'envio_bloqueos', titulo: 'Bloqueos', orden: 'fecha.asc',
    permiteNuevo: true, permiteBorrar: true,
    columnas: [
      { campo: 'fecha', label: 'Fecha', tipo: 'fecha' },
      { campo: 'grupo_ruta', label: 'Corredor (vacío = todos)', tipo: 'select', opciones: ['', ...CORREDORES], nullable: true },
      { campo: 'motivo', label: 'Motivo', tipo: 'texto' },
    ],
  },
  repartidores: {
    tabla: 'repartidores', titulo: 'Repartidores', orden: 'nombre.asc',
    permiteNuevo: true,
    columnas: [
      { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['propio', 'cadeteria'] },
      { campo: 'telefono', label: 'Teléfono', tipo: 'texto', nullable: true },
      { campo: 'activo', label: 'Activo', tipo: 'bool' },
    ],
  },
  mensajes: {
    tabla: 'mensajes_plantillas', titulo: 'Mensajes', orden: 'estado.asc', clave: 'estado',
    columnas: [
      { campo: 'estado', label: 'Estado', tipo: 'texto', soloLectura: true },
      { campo: 'cuerpo', label: 'Mensaje ({nombre} {numero} {fecha} {franja} {sucursal} {zona} {costo_envio} {link})', tipo: 'parrafo' },
      { campo: 'activa', label: 'Activa', tipo: 'bool' },
    ],
  },
};

export const ORDEN_TABS = ['zonas', 'tarifas', 'franjas', 'sucursales', 'cupos', 'bloqueos', 'repartidores', 'mensajes'] as const;

// --- Valor mostrado en el input, a partir del valor crudo de la fila -----
export function valorInicial(col: ColumnaDef, valor: unknown): string | boolean {
  if (col.tipo === 'bool') return !!valor;
  if (col.tipo === 'lista_numeros') return ((valor as number[]) || []).join(',');
  if (col.tipo === 'lista_texto') return ((valor as string[]) || []).join(', ');
  if (col.tipo === 'hora' && valor) return String(valor).slice(0, 5);
  return valor == null ? '' : String(valor);
}

// --- Valor a guardar, a partir de lo que el admin tipeó/tildó ------------
export function leerValor(col: ColumnaDef, crudo: string | boolean): unknown {
  if (col.soloLectura) return undefined;
  if (col.tipo === 'bool') return !!crudo;
  if (col.tipo === 'numero') {
    const texto = String(crudo);
    if (texto === '' && col.nullable) return null;
    return Number(texto);
  }
  if (col.tipo === 'lista_numeros') {
    return String(crudo).split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number);
  }
  if (col.tipo === 'lista_texto') {
    return String(crudo).split(',').map((s) => s.trim()).filter((s) => s !== '');
  }
  if (col.nullable && crudo === '') return null;
  return crudo;
}

export type OrdenParte = { columna: string; ascendente: boolean };

export function parsearOrden(orden: string): OrdenParte[] {
  return orden.split(',').map((parte) => {
    const [columna, direccion] = parte.split('.');
    return { columna, ascendente: direccion !== 'desc' };
  });
}
