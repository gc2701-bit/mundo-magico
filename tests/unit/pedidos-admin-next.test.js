/* lib/pedidos-admin.ts — panel de administración de pedidos (Sprint 5,
 * Task 5.3), portado de public/assets/admin-pedidos.js. Cubre el ciclo
 * operativo central: listar/agrupar/filtrar, estado, mensajes, fecha de
 * envío. Ver la nota de alcance en el archivo fuente para lo que queda
 * fuera de esta tanda (modo "plan de reparto", métricas, archivado).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  hoyLocalISO, esAtrasado, diasAtraso, esTraslado, bultosDe, claveGrupo, agruparPedidos,
  statsPorEstado, filtrarPedidos, resolverMensaje, sugerirFechaEnvio, franjasDelPedido, zonaDePedido,
} from '../../lib/pedidos-admin';
import { ESTADOS, plata } from '../../lib/envios';

function pedido(overrides = {}) {
  return {
    id: 'p1', user_id: 'u1', numero: 1001, items: [{ t: 'Globo', q: 2 }], nombre: 'Ana', nota: '',
    telefono: '3815555555', created_at: '2026-01-01T10:00:00Z', estado: 'nuevo', metodo_entrega: 'retiro',
    direccion: null, zona: null, zona_id: null, zona_nombre: null, costo_envio: null, franja_id: null,
    fecha_entrega: null, sucursal_id: null, sucursal_armado: null, entre_calles: null, piso_depto: null,
    receptor_nombre: null, receptor_telefono: null, bultos: null, motivo_ausente: null,
    ...overrides,
  };
}

describe('hoyLocalISO / esAtrasado / diasAtraso', () => {
  it('hoyLocalISO usa la fecha local, no UTC', () => {
    expect(hoyLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('un pedido con fecha pasada y estado vivo está atrasado', () => {
    const p = pedido({ fecha_entrega: '2026-01-01', estado: 'confirmado' });
    expect(esAtrasado(p, '2026-01-05')).toBe(true);
    expect(diasAtraso(p, '2026-01-05')).toBe(4);
  });

  it('entregado/cancelado nunca cuentan como atrasados aunque la fecha pasó', () => {
    expect(esAtrasado(pedido({ fecha_entrega: '2026-01-01', estado: 'entregado' }), '2026-01-05')).toBe(false);
    expect(esAtrasado(pedido({ fecha_entrega: '2026-01-01', estado: 'cancelado' }), '2026-01-05')).toBe(false);
  });

  it('sin fecha, o con fecha futura, no está atrasado', () => {
    expect(esAtrasado(pedido({ fecha_entrega: null, estado: 'nuevo' }), '2026-01-05')).toBe(false);
    expect(esAtrasado(pedido({ fecha_entrega: '2026-01-10', estado: 'nuevo' }), '2026-01-05')).toBe(false);
  });
});

describe('esTraslado', () => {
  it('retiro con sucursal_armado distinta de sucursal_id, en preparación o en tránsito: es traslado', () => {
    const p = pedido({ metodo_entrega: 'retiro', sucursal_id: 's-yb', sucursal_armado: 's-centro', estado: 'en_preparacion' });
    expect(esTraslado(p)).toBe(true);
    expect(esTraslado({ ...p, estado: 'en_transito' })).toBe(true);
  });
  it('no es traslado si ya está listo/entregado, si es envío, o si arma y entrega en la misma sucursal', () => {
    const p = pedido({ metodo_entrega: 'retiro', sucursal_id: 's-yb', sucursal_armado: 's-centro', estado: 'listo' });
    expect(esTraslado(p)).toBe(false);
    expect(esTraslado({ ...p, estado: 'en_preparacion', metodo_entrega: 'envio' })).toBe(false);
    expect(esTraslado({ ...p, estado: 'en_preparacion', sucursal_armado: 's-yb' })).toBe(false);
  });
});

describe('bultosDe', () => {
  it('chico=1, mediano=2, grande=3, sin clasificar=1 (nunca bloquea)', () => {
    expect(bultosDe(pedido({ bultos: 'chico' }))).toBe(1);
    expect(bultosDe(pedido({ bultos: 'mediano' }))).toBe(2);
    expect(bultosDe(pedido({ bultos: 'grande' }))).toBe(3);
    expect(bultosDe(pedido({ bultos: null }))).toBe(1);
  });
});

describe('claveGrupo / agruparPedidos', () => {
  it('modo fecha: agrupa por fecha legible, o "Sin fecha pedida"', () => {
    expect(claveGrupo(pedido({ fecha_entrega: '2026-01-05' }), 'fecha')).toBe('05/01/2026');
    expect(claveGrupo(pedido({ fecha_entrega: null }), 'fecha')).toBe('Sin fecha pedida');
  });
  it('modo metodo: Envío a domicilio / Retiro en el local', () => {
    expect(claveGrupo(pedido({ metodo_entrega: 'envio' }), 'metodo')).toBe('Envío a domicilio');
    expect(claveGrupo(pedido({ metodo_entrega: 'retiro' }), 'metodo')).toBe('Retiro en el local');
  });
  it('modo zona: retiro siempre es "Retiro en el local"; envío usa zona_nombre/zona', () => {
    expect(claveGrupo(pedido({ metodo_entrega: 'retiro' }), 'zona')).toBe('Retiro en el local');
    expect(claveGrupo(pedido({ metodo_entrega: 'envio', zona_nombre: 'Yerba Buena' }), 'zona')).toBe('Yerba Buena');
    expect(claveGrupo(pedido({ metodo_entrega: 'envio', zona_nombre: null, zona: null }), 'zona')).toBe('Envío sin zona indicada');
  });
  it('modo estado: usa ESTADOS_TXT', () => {
    expect(claveGrupo(pedido({ estado: 'confirmado' }), 'estado')).toBe('Confirmado');
  });

  it('agruparPedidos preserva el orden de aparición de cada clave nueva', () => {
    const lista = [pedido({ id: 'a', estado: 'nuevo' }), pedido({ id: 'b', estado: 'confirmado' }), pedido({ id: 'c', estado: 'nuevo' })];
    const grupos = agruparPedidos(lista, 'estado');
    expect(grupos.map((g) => g.clave)).toEqual(['Nuevo', 'Confirmado']);
    expect(grupos[0].pedidos.map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('statsPorEstado', () => {
  it('cuenta "Todos" + cada estado + atrasados si hay alguno', () => {
    const lista = [
      pedido({ id: 'a', estado: 'nuevo' }),
      pedido({ id: 'b', estado: 'confirmado' }),
      pedido({ id: 'c', estado: 'confirmado', fecha_entrega: '2020-01-01' }),
    ];
    const stats = statsPorEstado(lista, ESTADOS);
    expect(stats[0]).toEqual({ valor: '', cantidad: 3, etiqueta: 'Todos' });
    expect(stats.find((s) => s.valor === 'confirmado').cantidad).toBe(2);
    expect(stats.find((s) => s.valor === '__atrasados').cantidad).toBe(1);
  });

  it('sin atrasados, no aparece el badge', () => {
    const stats = statsPorEstado([pedido({ estado: 'nuevo' })], ESTADOS);
    expect(stats.find((s) => s.valor === '__atrasados')).toBeUndefined();
  });
});

describe('filtrarPedidos', () => {
  const lista = [pedido({ id: 'a', estado: 'nuevo' }), pedido({ id: 'b', estado: 'confirmado', fecha_entrega: '2020-01-01' })];
  it('sin filtro, devuelve todo', () => {
    expect(filtrarPedidos(lista, '')).toHaveLength(2);
  });
  it('filtro por estado', () => {
    expect(filtrarPedidos(lista, 'nuevo').map((p) => p.id)).toEqual(['a']);
  });
  it('__atrasados filtra por esAtrasado()', () => {
    expect(filtrarPedidos(lista, '__atrasados').map((p) => p.id)).toEqual(['b']);
  });
});

describe('resolverMensaje', () => {
  const datosEnvios = { tarifas: [], zonas: [], franjas: [{ id: 'f1', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1] }], sucursales: [], config: {} };
  const sucursales = [{ id: 's1', nombre: 'Junín 351', requiere_transferencia: false }];

  it('reemplaza todos los placeholders conocidos', () => {
    const p = pedido({ nombre: 'Ana', numero: 1042, fecha_entrega: '2026-01-05', franja_id: 'f1', sucursal_id: 's1', zona_nombre: 'Centro', costo_envio: 2000 });
    const msg = resolverMensaje(p, 'Hola {nombre}! Pedido #{numero} para el {fecha} ({franja}) en {sucursal}, zona {zona}, envío {costo_envio}.', datosEnvios, sucursales);
    expect(msg).toBe(`Hola Ana! Pedido #1042 para el 05/01/2026 (Mañana) en Junín 351, zona Centro, envío ${plata(2000)}.`);
  });

  it('placeholders sin dato disponible quedan vacíos, no rompen', () => {
    const p = pedido({ nombre: null, numero: null, fecha_entrega: null });
    const msg = resolverMensaje(p, 'Hola {nombre}! #{numero} el {fecha}', datosEnvios, sucursales);
    expect(msg).toBe('Hola ! # el ');
  });
});

describe('sugerirFechaEnvio', () => {
  const datosEnvios = { tarifas: [], zonas: [], franjas: [], sucursales: [], config: { horizonte_dias: 14 } };

  it('sin zona_id, no sugiere nada', async () => {
    const sb = { rpc: vi.fn() };
    expect(await sugerirFechaEnvio(sb, { zona_id: null }, datosEnvios)).toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('prefiere un día dentro de la ventana de 1-3 días si hay disponible', async () => {
    const sb = { rpc: vi.fn().mockResolvedValue({
      data: [
        { fecha: '2026-01-01', disponible: false },
        { fecha: '2026-01-02', disponible: true },
        { fecha: '2026-01-10', disponible: true },
      ],
      error: null,
    }) };
    const fecha = await sugerirFechaEnvio(sb, { zona_id: 'z1' }, datosEnvios);
    expect(fecha).toBe('2026-01-02');
  });

  it('sin nada disponible, devuelve null', async () => {
    const sb = { rpc: vi.fn().mockResolvedValue({ data: [{ fecha: '2026-01-01', disponible: false }], error: null }) };
    expect(await sugerirFechaEnvio(sb, { zona_id: 'z1' }, datosEnvios)).toBeNull();
  });
});

describe('franjasDelPedido / zonaDePedido', () => {
  const datos = {
    tarifas: [], zonas: [{ id: 'z1', slug: 'centro', nombre: 'Centro', grupo_ruta: 'centro', tarifa_id: 't1' }],
    franjas: [{ id: 'f1', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1] }],
    sucursales: [], config: {},
  };
  it('franjasDelPedido filtra por el día de la semana de la fecha', () => {
    expect(franjasDelPedido(datos, '2026-01-05').map((f) => f.id)).toEqual(['f1']); // lunes
    expect(franjasDelPedido(datos, '2026-01-06')).toEqual([]); // martes
  });
  it('zonaDePedido resuelve por zona_id', () => {
    expect(zonaDePedido(datos, { zona_id: 'z1' })?.nombre).toBe('Centro');
    expect(zonaDePedido(datos, { zona_id: null })).toBeNull();
  });
});
