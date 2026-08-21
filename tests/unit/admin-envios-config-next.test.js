/* lib/admin-envios-config.ts — editor de configuración de envíos (Sprint 5,
 * Task 5.4), portado de public/assets/admin-envios.js. Cubre la conversión
 * de valores entre la fila de Supabase y los inputs del editor, en las dos
 * direcciones — la parte genuinamente propensa a bugs de un editor
 * genérico manejado por metadatos.
 */
import { describe, it, expect } from 'vitest';
import { TABLAS, ORDEN_TABS, valorInicial, leerValor, parsearOrden } from '../../lib/admin-envios-config';

describe('TABLAS', () => {
  it('las 8 tablas de ORDEN_TABS existen en TABLAS con al menos una columna', () => {
    expect(ORDEN_TABS).toHaveLength(8);
    ORDEN_TABS.forEach((clave) => {
      expect(TABLAS[clave]).toBeTruthy();
      expect(TABLAS[clave].columnas.length).toBeGreaterThan(0);
    });
  });

  it('mensajes usa "estado" como clave primaria (no id)', () => {
    expect(TABLAS.mensajes.clave).toBe('estado');
  });

  it('sólo bloqueos y repartidores permiten filas nuevas; sólo bloqueos permite borrar', () => {
    expect(TABLAS.bloqueos.permiteNuevo).toBe(true);
    expect(TABLAS.bloqueos.permiteBorrar).toBe(true);
    expect(TABLAS.repartidores.permiteNuevo).toBe(true);
    expect(TABLAS.repartidores.permiteBorrar).toBeUndefined();
    expect(TABLAS.zonas.permiteNuevo).toBeUndefined();
  });
});

describe('valorInicial', () => {
  it('bool: castea cualquier valor a boolean', () => {
    const col = { campo: 'activa', label: '', tipo: 'bool' };
    expect(valorInicial(col, true)).toBe(true);
    expect(valorInicial(col, null)).toBe(false);
    expect(valorInicial(col, undefined)).toBe(false);
  });

  it('lista_numeros: array a texto separado por coma (sin espacios)', () => {
    const col = { campo: 'dias_semana', label: '', tipo: 'lista_numeros' };
    expect(valorInicial(col, [1, 2, 3])).toBe('1,2,3');
    expect(valorInicial(col, null)).toBe('');
    expect(valorInicial(col, [])).toBe('');
  });

  it('lista_texto: array a texto separado por ", "', () => {
    const col = { campo: 'alias', label: '', tipo: 'lista_texto' };
    expect(valorInicial(col, ['Yerba Buena', 'YB'])).toBe('Yerba Buena, YB');
    expect(valorInicial(col, null)).toBe('');
  });

  it('hora: recorta a HH:MM (Postgres da HH:MM:SS)', () => {
    const col = { campo: 'hora_inicio', label: '', tipo: 'hora' };
    expect(valorInicial(col, '09:00:00')).toBe('09:00');
    expect(valorInicial(col, null)).toBe('');
  });

  it('numero/texto: null/undefined muestran vacío, no "null"', () => {
    const col = { campo: 'costo', label: '', tipo: 'numero' };
    expect(valorInicial(col, null)).toBe('');
    expect(valorInicial(col, 2000)).toBe('2000');
  });
});

describe('leerValor', () => {
  it('soloLectura: nunca se guarda (undefined, para que el caller lo omita del payload)', () => {
    const col = { campo: 'slug', label: '', tipo: 'texto', soloLectura: true };
    expect(leerValor(col, 'lo-que-sea')).toBeUndefined();
  });

  it('bool: siempre boolean', () => {
    const col = { campo: 'activa', label: '', tipo: 'bool' };
    expect(leerValor(col, true)).toBe(true);
    expect(leerValor(col, false)).toBe(false);
  });

  it('numero: convierte a Number; vacío+nullable es null; vacío sin nullable es 0 (mismo comportamiento que el original: Number(""))', () => {
    const col = { campo: 'costo', label: '', tipo: 'numero' };
    expect(leerValor(col, '2000')).toBe(2000);
    expect(leerValor({ ...col, nullable: true }, '')).toBeNull();
    expect(leerValor(col, '')).toBe(0);
  });

  it('lista_numeros: parsea, recorta espacios, descarta vacíos', () => {
    const col = { campo: 'dias_semana', label: '', tipo: 'lista_numeros' };
    expect(leerValor(col, '1, 2,3 ,')).toEqual([1, 2, 3]);
    expect(leerValor(col, '')).toEqual([]);
  });

  it('lista_texto: parsea, recorta espacios, descarta vacíos', () => {
    const col = { campo: 'alias', label: '', tipo: 'lista_texto' };
    expect(leerValor(col, 'Yerba Buena, YB, ')).toEqual(['Yerba Buena', 'YB']);
  });

  it('texto nullable: string vacío se guarda como null, no como ""', () => {
    const col = { campo: 'descripcion', label: '', tipo: 'texto', nullable: true };
    expect(leerValor(col, '')).toBeNull();
    expect(leerValor(col, 'Zona centro')).toBe('Zona centro');
  });

  it('texto no-nullable: string vacío se guarda tal cual (lo rechaza la base, no acá)', () => {
    const col = { campo: 'nombre', label: '', tipo: 'texto' };
    expect(leerValor(col, '')).toBe('');
  });
});

describe('parsearOrden', () => {
  it('una columna, ascendente por defecto', () => {
    expect(parsearOrden('orden.asc')).toEqual([{ columna: 'orden', ascendente: true }]);
  });
  it('varias columnas, mezclando asc/desc', () => {
    expect(parsearOrden('grupo_ruta.asc,orden_ruta.desc')).toEqual([
      { columna: 'grupo_ruta', ascendente: true },
      { columna: 'orden_ruta', ascendente: false },
    ]);
  });
});
