/* lib/envios.ts — vocabulario y datos de envíos (Sprint 5, Task 5.2),
 * portado de public/assets/envios.js. Funciones puras primero; cargarEnvios/
 * cuposDisponibles (I/O) se prueban con un cliente Supabase falso.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RESPALDO, plata, zonaPorIdOSlug, tarifaDe, costoDe, franjasDelDia, franjaDelTurno,
  fechaLegible, hoyISO, isodow, sumarDiasISO, horaActualHHMM, mesCorto, distanciaKm,
  permisivo, cargarEnvios, cuposDisponibles, nombreCorredor,
} from '../../lib/envios';

describe('funciones puras', () => {
  it('plata formatea en ARS sin decimales', () => {
    expect(plata(3100)).toMatch(/3\.100/);
  });

  it('zonaPorIdOSlug encuentra por id o por slug', () => {
    expect(zonaPorIdOSlug(RESPALDO.zonas, 'lules')?.nombre).toBe('Lules');
    expect(zonaPorIdOSlug(RESPALDO.zonas, 'no-existe')).toBeNull();
    expect(zonaPorIdOSlug(RESPALDO.zonas, null)).toBeNull();
  });

  it('costoDe resuelve zona → tarifa → costo', () => {
    expect(costoDe(RESPALDO, 'lules')).toBe(5500); // lejano
    expect(costoDe(RESPALDO, 'smt-microcentro')).toBe(2000); // capital
    expect(costoDe(RESPALDO, null)).toBe(0);
  });

  it('tarifaDe devuelve null si no hay match', () => {
    expect(tarifaDe(RESPALDO.tarifas, 'no-existe')).toBeNull();
  });

  it('franjasDelDia filtra por isodow', () => {
    expect(franjasDelDia(RESPALDO.franjas, 6).map((f) => f.id)).toEqual(['sabado']);
    expect(franjasDelDia(RESPALDO.franjas, 7)).toEqual([]);
  });

  it('franjaDelTurno: primera es la que abre más temprano, última la que abre más tarde', () => {
    const dia = RESPALDO.franjas.filter((f) => f.dias_semana.includes(1));
    expect(franjaDelTurno(dia, 'primera')?.id).toBe('manana');
    expect(franjaDelTurno(dia, 'ultima')?.id).toBe('tarde');
    expect(franjaDelTurno([], 'primera')).toBeNull();
  });

  it('fechaLegible reformatea yyyy-mm-dd a dd/mm/aaaa sin pasar por Date/UTC', () => {
    expect(fechaLegible('2026-01-05')).toBe('05/01/2026');
    expect(fechaLegible('')).toBe('');
  });

  it('hoyISO/horaActualHHMM devuelven el formato esperado para una fecha dada', () => {
    expect(hoyISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(horaActualHHMM(new Date(2026, 0, 5, 9, 3))).toBe('09:03');
  });

  it('isodow: lunes=1 … domingo=7', () => {
    expect(isodow('2026-01-05')).toBe(1); // lunes
    expect(isodow('2026-01-11')).toBe(7); // domingo
  });

  it('sumarDiasISO suma días sin corrimiento por huso horario', () => {
    expect(sumarDiasISO('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('mesCorto', () => {
    expect(mesCorto('01')).toBe('ene');
    expect(mesCorto('13')).toBe('');
  });

  it('distanciaKm: mismo punto es 0, dos puntos conocidos dan un valor razonable', () => {
    expect(distanciaKm(-26.8, -65.2, -26.8, -65.2)).toBe(0);
    const centro = RESPALDO.zonas.find((z) => z.id === 'smt-microcentro');
    const lejos = distanciaKm(centro.lat, centro.lng, -27.2, -65.2);
    expect(lejos).toBeGreaterThan(40);
  });

  it('permisivo: todo disponible salvo domingo', () => {
    const dias = permisivo('2026-01-05', '2026-01-11');
    expect(dias).toHaveLength(7);
    expect(dias.find((d) => d.fecha === '2026-01-11')).toEqual({ fecha: '2026-01-11', disponible: false, motivo: 'domingo' });
    expect(dias.find((d) => d.fecha === '2026-01-05').disponible).toBe(true);
  });

  it('nombreCorredor traduce el grupo_ruta, o lo devuelve tal cual si no lo conoce', () => {
    expect(nombreCorredor('oeste')).toBe('Oeste');
    expect(nombreCorredor('marte')).toBe('marte');
  });
});

function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
}

describe('cargarEnvios', () => {
  it('con Supabase respondiendo bien, arma DatosEnvios desde las 5 tablas', async () => {
    const sb = {
      from(tabla) {
        const chain = {
          select: () => chain,
          order: () => chain,
          eq: () => Promise.resolve({ data: datosPorTabla(tabla), error: null }),
          then: (res) => Promise.resolve({ data: datosPorTabla(tabla), error: null }).then(res),
        };
        return chain;
      },
    };
    function datosPorTabla(t) {
      if (t === 'envio_config') return [{ horizonte_dias: 14, cobrar_envio: true, minimo_compra: 0, costo_envio_inmediato: 0, corte_inmediato_hora: '13:00:00', entrega_propia: true }];
      if (t === 'envio_tarifas') return [{ id: 'x', nombre: 'X', costo: 100 }];
      return [];
    }
    const datos = await cargarEnvios(sb, fakeStorage());
    expect(datos.tarifas).toEqual([{ id: 'x', nombre: 'X', costo: 100 }]);
    expect(datos.config.entrega_propia).toBe(true);
  });

  it('si Supabase falla, cae a RESPALDO', async () => {
    const sb = { from: () => ({ select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: null, error: new Error('caído') }) }) }) }) };
    const datos = await cargarEnvios(sb, fakeStorage());
    expect(datos).toEqual(RESPALDO);
  });

  it('usa la cache de sessionStorage si está vigente, sin volver a pedirle nada a Supabase', async () => {
    const storage = fakeStorage();
    storage.setItem('mm_envios_cache_v1', JSON.stringify({ t: Date.now(), data: RESPALDO }));
    const sb = { from: vi.fn() };
    const datos = await cargarEnvios(sb, storage);
    expect(datos).toEqual(RESPALDO);
    expect(sb.from).not.toHaveBeenCalled();
  });
});

describe('cuposDisponibles', () => {
  it('llama al RPC con los parámetros esperados y devuelve su resultado', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ fecha: '2026-01-05', disponible: true }], error: null });
    const sb = { rpc };
    const dias = await cuposDisponibles(sb, '2026-01-05', '2026-01-11', 'z1', 's1', true);
    expect(rpc).toHaveBeenCalledWith('cupos_disponibles', {
      p_desde: '2026-01-05', p_hasta: '2026-01-11', p_zona_id: 'z1', p_sucursal_id: 's1', p_ignorar_anticipacion: true,
    });
    expect(dias).toEqual([{ fecha: '2026-01-05', disponible: true }]);
  });

  it('si el RPC falla, cae al respaldo permisivo (nunca "todo bloqueado")', async () => {
    const sb = { rpc: vi.fn().mockRejectedValue(new Error('caído')) };
    const dias = await cuposDisponibles(sb, '2026-01-05', '2026-01-06', 'z1');
    expect(dias.every((d) => d.motivo !== 'cupo_pedidos')).toBe(true);
    expect(dias).toEqual(permisivo('2026-01-05', '2026-01-06'));
  });
});
