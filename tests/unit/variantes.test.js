/* lib/variantes.ts — selector talle×tipo de la ficha pública (Sprint 5). */
import { describe, it, expect } from 'vitest';
import {
  valoresDeEje,
  ejeElegible,
  seleccionInicial,
  valoresAlcanzables,
  seleccionCompleta,
  resolverVariante,
  etiquetaVariante
} from '../../lib/variantes.ts';

const MATRIZ = [
  { talle: 'Chico', tipo: 'Rojo', codigo: 'CR', activo: true },
  { talle: 'Chico', tipo: 'Azul', codigo: 'CA', activo: true },
  { talle: 'Grande', tipo: 'Rojo', codigo: 'GR', activo: true },
  { talle: 'Grande', tipo: 'Azul', codigo: 'GA', activo: false } // sacada de la venta
];

describe('variantes — valoresDeEje', () => {
  it('sólo cuenta valores de variantes activas', () => {
    expect(valoresDeEje(MATRIZ, 'talle').sort()).toEqual(['Chico', 'Grande']);
    expect(valoresDeEje(MATRIZ, 'tipo').sort()).toEqual(['Azul', 'Rojo']);
  });

  it('una variante inactiva no aporta su valor si es la única con ese valor', () => {
    const soloUnaGrandeAzulInactiva = [
      { talle: 'Chico', codigo: 'C', activo: true },
      { talle: 'Grande', codigo: 'G', activo: false }
    ];
    expect(valoresDeEje(soloUnaGrandeAzulInactiva, 'talle')).toEqual(['Chico']);
  });

  it('sin variantes, lista vacía', () => {
    expect(valoresDeEje([], 'talle')).toEqual([]);
  });
});

describe('variantes — ejeElegible', () => {
  it('más de un valor activo -> elegible', () => {
    expect(ejeElegible(MATRIZ, 'talle')).toBe(true);
  });

  it('un solo valor posible -> no elegible (nada que elegir)', () => {
    const soloChico = [
      { talle: 'Chico', tipo: 'Rojo', codigo: 'A', activo: true },
      { talle: 'Chico', tipo: 'Azul', codigo: 'B', activo: true }
    ];
    expect(ejeElegible(soloChico, 'talle')).toBe(false);
    expect(ejeElegible(soloChico, 'tipo')).toBe(true);
  });

  it('eje sin usar (nadie le puso tipo) -> no elegible', () => {
    const soloTalles = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    expect(ejeElegible(soloTalles, 'tipo')).toBe(false);
  });
});

describe('variantes — seleccionInicial', () => {
  it('ejes con un solo valor arrancan resueltos solos', () => {
    const soloTalles = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    expect(seleccionInicial(soloTalles)).toEqual({ talle: null, tipo: null });
  });

  it('un único talle con varios tipos: talle resuelto, tipo sin elegir', () => {
    const unTalleVariosTipos = [
      { talle: 'Único', tipo: 'Rojo', codigo: 'A', activo: true },
      { talle: 'Único', tipo: 'Azul', codigo: 'B', activo: true }
    ];
    expect(seleccionInicial(unTalleVariosTipos)).toEqual({ talle: 'Único', tipo: null });
  });

  it('matriz completa: ambos sin elegir', () => {
    expect(seleccionInicial(MATRIZ)).toEqual({ talle: null, tipo: null });
  });
});

describe('variantes — valoresAlcanzables (filtrado mutuo)', () => {
  it('elegir un talle acota los tipos disponibles a los que existen para ese talle', () => {
    // Grande sólo tiene Rojo activo (Grande×Azul está inactiva).
    expect(valoresAlcanzables(MATRIZ, 'tipo', { talle: 'Grande', tipo: null })).toEqual(['Rojo']);
  });

  it('elegir un tipo acota los talles disponibles a los que existen para ese tipo', () => {
    expect(valoresAlcanzables(MATRIZ, 'talle', { talle: null, tipo: 'Rojo' }).sort()).toEqual(['Chico', 'Grande']);
  });

  it('sin nada elegido en el otro eje, todos los valores activos son alcanzables', () => {
    expect(valoresAlcanzables(MATRIZ, 'talle', { talle: null, tipo: null }).sort()).toEqual(['Chico', 'Grande']);
  });

  it('una variante inactiva nunca hace alcanzable una combinación', () => {
    // Grande×Azul está inactiva -> "Azul" no debe aparecer como alcanzable cuando ya se eligió Grande.
    expect(valoresAlcanzables(MATRIZ, 'tipo', { talle: 'Grande', tipo: null })).not.toContain('Azul');
  });
});

describe('variantes — seleccionCompleta', () => {
  it('falsa mientras falte un eje elegible', () => {
    expect(seleccionCompleta(MATRIZ, { talle: 'Chico', tipo: null })).toBe(false);
  });

  it('verdadera con los dos ejes elegidos', () => {
    expect(seleccionCompleta(MATRIZ, { talle: 'Chico', tipo: 'Rojo' })).toBe(true);
  });

  it('un eje no elegible (un solo valor posible) no bloquea la selección completa', () => {
    const soloTipos = [
      { tipo: 'Rojo', codigo: 'A', activo: true },
      { tipo: 'Azul', codigo: 'B', activo: true }
    ];
    expect(seleccionCompleta(soloTipos, { talle: null, tipo: 'Rojo' })).toBe(true);
  });
});

describe('variantes — resolverVariante', () => {
  it('selección incompleta -> null', () => {
    expect(resolverVariante(MATRIZ, { talle: 'Chico', tipo: null })).toBeNull();
  });

  it('resuelve la variante activa que matchea la combinación completa', () => {
    expect(resolverVariante(MATRIZ, { talle: 'Chico', tipo: 'Azul' })?.codigo).toBe('CA');
    expect(resolverVariante(MATRIZ, { talle: 'Grande', tipo: 'Rojo' })?.codigo).toBe('GR');
  });

  it('una combinación inactiva nunca resuelve, aunque la selección "matchee" sus valores', () => {
    expect(resolverVariante(MATRIZ, { talle: 'Grande', tipo: 'Azul' })).toBeNull();
  });

  it('con un solo eje en juego, alcanza con elegir ese eje', () => {
    const soloTalles = [{ talle: 'Chico', codigo: 'A', activo: true }, { talle: 'Grande', codigo: 'B', activo: true }];
    expect(resolverVariante(soloTalles, { talle: 'Grande', tipo: null })?.codigo).toBe('B');
  });
});

describe('variantes — etiquetaVariante', () => {
  it('combina talle y tipo cuando los dos existen', () => {
    expect(etiquetaVariante({ talle: 'Chico', tipo: 'Rojo' })).toBe('Chico · Rojo');
  });

  it('sólo el que exista, sin separador colgando', () => {
    expect(etiquetaVariante({ talle: 'Chico' })).toBe('Chico');
    expect(etiquetaVariante({ tipo: 'Rojo' })).toBe('Rojo');
  });

  it('sin ninguno, string vacío', () => {
    expect(etiquetaVariante({})).toBe('');
  });
});
