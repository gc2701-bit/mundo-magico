/* lib/envio-form-logic.ts — formulario de entrega (Sprint 5, Task 5.2),
 * portado de public/assets/envio-form.js. Mismos casos que
 * tests/unit/envio-form.test.js (la versión DOM del sitio viejo), acá contra
 * funciones puras: leerDatos()/validar()/resumenTexto().
 */
import { describe, it, expect, vi } from 'vitest';
import { estadoInicial, leerDatos, validar, resumenTexto, calcularProximoTurno } from '../../lib/envio-form-logic';
import { plata } from '../../lib/envios';

function datosEnvios(overrides = {}) {
  return {
    tarifas: [{ id: 't1', nombre: 'Capital', costo: 300 }],
    zonas: [{ id: 'z1', nombre: 'Centro', grupo_ruta: 'centro', tarifa_id: 't1', lat: -26.8, lng: -65.2 }],
    franjas: [{ id: 'f1', nombre: 'Mañana (9 a 13)', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] }],
    sucursales: [{ id: 's1', nombre: 'Sucursal Centro', requiere_transferencia: false }],
    config: { entrega_propia: true, cobrar_envio: true, minimo_compra: 0, horizonte_dias: 14, corte_inmediato_hora: '13:00:00', costo_envio_inmediato: 500 },
    ...overrides,
  };
}

describe('validar — puerta antes de mandar el pedido por WhatsApp', () => {
  it('sin elegir método, falla con mensaje claro', () => {
    const datos = datosEnvios();
    const d = leerDatos(estadoInicial(), datos);
    const r = validar(d, datos);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/Elegí si retirás/i);
  });

  it('retiro sin sucursal falla', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'retiro' }, datos);
    const r = validar(d, datos);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/sucursal/i);
  });

  it('retiro con sucursal pero sin fecha/franja falla', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'retiro', sucursalId: 's1' }, datos);
    const r = validar(d, datos);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/franja|fecha|cuándo/i);
  });

  it('retiro con sucursal + fecha + franja completos: pasa', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'retiro', sucursalId: 's1', fecha: '2026-01-05', franjaId: 'f1' }, datos);
    expect(validar(d, datos)).toEqual({ ok: true });
  });

  it('envío con reparto propio (entrega_propia:true) sin zona falla', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', direccion: 'Av. Siempre Viva 123' }, datos);
    const r = validar(d, datos);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/zona/i);
  });

  it('envío con zona y dirección completos: pasa', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'Av. Siempre Viva 123' }, datos);
    expect(validar(d, datos)).toEqual({ ok: true });
  });

  it('sin reparto propio (entrega_propia:false), el envío NO exige zona — sólo dirección', () => {
    const datos = datosEnvios({ config: { ...datosEnvios().config, entrega_propia: false } });
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', direccion: 'Av. Siempre Viva 123' }, datos);
    expect(validar(d, datos)).toEqual({ ok: true });
  });

  it('envío inmediato tildado pero sin turno resuelto: falla con mensaje específico', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X 123', envioInmediato: true, turnoInmediato: null }, datos);
    const r = validar(d, datos);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/turno inmediato/i);
  });

  it('envío inmediato con turno resuelto: pasa, y fechaEntrega queda seteada', () => {
    const datos = datosEnvios();
    const estado = {
      ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X 123',
      envioInmediato: true, turnoInmediato: { fecha: '2026-01-05', franjaId: 'f1', franjaNombre: 'Mañana' }, fecha: '2026-01-05', franjaId: 'f1',
    };
    const d = leerDatos(estado, datos);
    expect(d.fechaEntrega).toBe('2026-01-05');
    expect(d.envioInmediato).toBe(true);
    expect(validar(d, datos)).toEqual({ ok: true });
  });

  it('la regla de "no confiar en el cliente": costoEnvio se recalcula desde la tarifa de la zona, no viaja editable', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X 123' }, datos);
    expect(d.costoEnvio).toBe(300); // tarifa t1
  });

  it('envío normal (sin envío inmediato) no exige fecha/franja — el negocio la asigna después', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X 123' }, datos);
    expect(d.fechaEntrega).toBe('');
    expect(validar(d, datos)).toEqual({ ok: true });
  });
});

describe('leerDatos — campos ocultos según el método', () => {
  it('en retiro, los campos de envío quedan vacíos aunque el estado tenga basura cargada', () => {
    const datos = datosEnvios();
    const estado = { ...estadoInicial(), metodo: 'retiro', sucursalId: 's1', zonaId: 'z1', direccion: 'algo', fecha: '2026-01-05', franjaId: 'f1' };
    const d = leerDatos(estado, datos);
    expect(d.zonaId).toBeNull();
    expect(d.zonaNombre).toBe('');
    expect(d.direccion).toBe('');
  });

  it('en envío, sucursalId/sucursalNombre quedan vacíos', () => {
    const datos = datosEnvios();
    const estado = { ...estadoInicial(), metodo: 'envio', sucursalId: 's1', zonaId: 'z1', direccion: 'X' };
    const d = leerDatos(estado, datos);
    expect(d.sucursalId).toBeNull();
    expect(d.sucursalNombre).toBe('');
  });

  it('receptor sólo viaja si recibeOtra está tildado', () => {
    const datos = datosEnvios();
    const estado = { ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X', receptorNombre: 'Juan', recibeOtra: false };
    expect(leerDatos(estado, datos).receptorNombre).toBe('');
    expect(leerDatos({ ...estado, recibeOtra: true }, datos).receptorNombre).toBe('Juan');
  });

  it('telefono viene del segundo parámetro (cuenta del cliente), no del estado del form', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'retiro' }, datos, '3811234567');
    expect(d.telefono).toBe('3811234567');
  });
});

describe('resumenTexto — bloque de entrega para el mensaje de WhatsApp', () => {
  it('retiro: una sola línea con la sucursal', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'retiro', sucursalId: 's1', fecha: '2026-01-05', franjaId: 'f1' }, datos);
    const L = resumenTexto(d);
    expect(L).toContain('*Entrega:* Retiro en Sucursal Centro');
    expect(L).toContain('*Para cuándo:* 05/01/2026');
    expect(L).toContain('*Franja:* Mañana (9 a 13)');
  });

  it('envío con reparto propio y sin fecha: aclara "entrega estimada" + costo', () => {
    const datos = datosEnvios();
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'Calle 123' }, datos);
    const L = resumenTexto(d);
    expect(L).toContain('*Entrega:* Envío — Centro (Calle 123)');
    expect(L.some((l) => /Entrega estimada/.test(l))).toBe(true);
    expect(L).toContain(`*Costo de envío:* ${plata(300)} (más el total de los productos)`);
  });

  it('envío sin reparto propio: sin costo, aclara que lo coordina el cliente', () => {
    const datos = datosEnvios({ config: { ...datosEnvios().config, entrega_propia: false } });
    const d = leerDatos({ ...estadoInicial(), metodo: 'envio', direccion: 'Calle 123' }, datos);
    const L = resumenTexto(d);
    expect(L.some((l) => /costo de envío/i.test(l))).toBe(false);
    expect(L.some((l) => /lo coordina y paga el cliente/i.test(l))).toBe(true);
  });

  it('envío inmediato: agrega la línea correspondiente y no la de "estimada"', () => {
    const datos = datosEnvios();
    const estado = {
      ...estadoInicial(), metodo: 'envio', zonaId: 'z1', direccion: 'X', envioInmediato: true,
      turnoInmediato: { fecha: '2026-01-05', franjaId: 'f1', franjaNombre: 'Mañana' }, fecha: '2026-01-05', franjaId: 'f1',
    };
    const d = leerDatos(estado, datos);
    const L = resumenTexto(d);
    expect(L).toContain('*Envío inmediato:* sí, en el próximo turno disponible');
    expect(L.some((l) => /Entrega estimada/.test(l))).toBe(false);
  });
});

describe('calcularProximoTurno', () => {
  it('antes del corte, intenta el turno de la tarde de hoy', async () => {
    const datos = datosEnvios({
      franjas: [
        { id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] },
        { id: 'tarde', nombre: 'Tarde', hora_inicio: '17:00', hora_fin: '21:00', dias_semana: [1, 2, 3, 4, 5] },
      ],
    });
    // 2026-01-05 es lunes; 10:00 es antes del corte (13:00).
    const sb = { rpc: vi.fn().mockResolvedValue({ data: [{ fecha: '2026-01-05', disponible: true }], error: null }) };
    const turno = await calcularProximoTurno(sb, datos, 'z1', new Date(2026, 0, 5, 10, 0));
    expect(turno).toEqual({ fecha: '2026-01-05', franjaId: 'tarde', franjaNombre: 'Tarde' });
  });

  it('después del corte, intenta la mañana de mañana', async () => {
    const datos = datosEnvios({
      franjas: [{ id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] }],
    });
    const sb = { rpc: vi.fn().mockResolvedValue({ data: [{ fecha: '2026-01-06', disponible: true }], error: null }) };
    const turno = await calcularProximoTurno(sb, datos, 'z1', new Date(2026, 0, 5, 15, 0));
    expect(turno).toEqual({ fecha: '2026-01-06', franjaId: 'manana', franjaNombre: 'Mañana' });
  });

  it('si el primer día no está disponible, prueba el siguiente hasta encontrar uno', async () => {
    const datos = datosEnvios({
      franjas: [{ id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] }],
    });
    const sb = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: [{ fecha: '2026-01-06', disponible: false, motivo: 'cupo_pedidos' }], error: null })
        .mockResolvedValueOnce({ data: [{ fecha: '2026-01-07', disponible: true }], error: null }),
    };
    const turno = await calcularProximoTurno(sb, datos, 'z1', new Date(2026, 0, 5, 15, 0));
    expect(turno).toEqual({ fecha: '2026-01-07', franjaId: 'manana', franjaNombre: 'Mañana' });
  });

  it('salta un domingo sin franjas sin romperse', async () => {
    // 2026-01-05 lunes 15:00 → arranca en martes 06; si sólo hay franjas
    // lunes-viernes, el próximo domingo (11) se salta solo sin llamar rpc.
    const datos = datosEnvios({
      franjas: [{ id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] }],
    });
    const sb = { rpc: vi.fn().mockResolvedValue({ data: [{ fecha: '2026-01-06', disponible: true }], error: null }) };
    await calcularProximoTurno(sb, datos, 'z1', new Date(2026, 0, 5, 15, 0));
    // No se llamó rpc con el domingo 11, porque franjaDelTurno ya lo filtra sin red.
    expect(sb.rpc).not.toHaveBeenCalledWith('cupos_disponibles', expect.objectContaining({ p_desde: '2026-01-11' }));
  });

  it('si no encuentra nada dentro del tope de intentos, devuelve null', async () => {
    const datos = datosEnvios({ franjas: [] }); // ninguna franja nunca
    const sb = { rpc: vi.fn() };
    const turno = await calcularProximoTurno(sb, datos, 'z1', new Date(2026, 0, 5, 15, 0));
    expect(turno).toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled(); // nunca hubo franja, nunca hizo falta preguntar
  });
});
