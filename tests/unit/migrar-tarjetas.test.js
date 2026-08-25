/* .claude/migrar-tarjetas-lib.js — funciones puras de la migración de
 * tarjetas del HTML a catalogo_productos (Sprint 1, Task 1.2/1.4 de
 * docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md).
 */
import { describe, it, expect } from 'vitest';
import {
  slugify,
  leerPares,
  resolverFamilia,
  codigoEfectivo,
  filaProducto
} from '../../.claude/migrar-tarjetas-lib.js';

describe('migrar-tarjetas-lib — slugify', () => {
  it('saca diacríticos y pasa a minúscula, igual que assets/precios.js', () => {
    expect(slugify('Anteojo Estrellita Rosé')).toBe('anteojo-estrellita-rose');
  });

  it('colapsa cualquier cosa que no sea a-z0-9 en un solo guión, sin bordes', () => {
    expect(slugify('  Combo  Cumpleañero!! ')).toBe('combo-cumpleanero');
  });

  it('vacío/undefined da string vacío', () => {
    expect(slugify('')).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('migrar-tarjetas-lib — leerPares', () => {
  it('parsea pares label:code separados por ;', () => {
    expect(leerPares('Chico:9283;Grande:4228')).toEqual([
      { label: 'Chico', code: '9283' },
      { label: 'Grande', code: '4228' }
    ]);
  });

  it('sin input o sin pares válidos da null', () => {
    expect(leerPares('')).toBeNull();
    expect(leerPares(null)).toBeNull();
    expect(leerPares('sin dos puntos')).toBeNull();
  });
});

describe('migrar-tarjetas-lib — resolverFamilia', () => {
  const familiaPorCodigo = { '04375': 'GLOBOS', '09821': 'GLOBOS', '11111': 'DISFRACES' };

  it('código simple con match directo devuelve esa familia', () => {
    expect(resolverFamilia('04375', null, familiaPorCodigo)).toBe('GLOBOS');
  });

  it('código simple sin match devuelve null', () => {
    expect(resolverFamilia('99999', null, familiaPorCodigo)).toBeNull();
  });

  it('sin código y sin talles devuelve null', () => {
    expect(resolverFamilia(null, null, familiaPorCodigo)).toBeNull();
  });

  it('talles: todas las opciones resuelven a la misma familia -> esa familia', () => {
    const talles = [{ label: 'Chico', code: '04375' }, { label: 'Grande', code: '09821' }];
    expect(resolverFamilia(null, talles, familiaPorCodigo)).toBe('GLOBOS');
  });

  it('talles: opciones resuelven a familias distintas -> null (no adivina)', () => {
    const talles = [{ label: 'Chico', code: '04375' }, { label: 'Grande', code: '11111' }];
    expect(resolverFamilia(null, talles, familiaPorCodigo)).toBeNull();
  });

  it('talles: alguna opción sin match -> null (no alcanza con que coincidan las que sí matchean)', () => {
    const talles = [{ label: 'Chico', code: '04375' }, { label: 'Grande', code: '00000' }];
    expect(resolverFamilia(null, talles, familiaPorCodigo)).toBeNull();
  });
});

describe('migrar-tarjetas-lib — codigoEfectivo', () => {
  it('codigo_override del overlay manda sobre el data-pos del HTML', () => {
    expect(codigoEfectivo('04375', { codigo_override: '09821' })).toBe('09821');
  });

  it('sin override, usa el data-pos', () => {
    expect(codigoEfectivo('04375', null)).toBe('04375');
    expect(codigoEfectivo('04375', {})).toBe('04375');
  });

  it('sin nada, null', () => {
    expect(codigoEfectivo(null, null)).toBeNull();
  });
});

describe('migrar-tarjetas-lib — filaProducto', () => {
  const familiaPorCodigo = { '04375': 'GLOBOS' };

  it('arma la fila de un producto simple, oculta=false por defecto (sin overlay)', () => {
    const tarjeta = {
      pagina: 'globos-fiesta-v2.html',
      slug: 'globo-negro',
      titulo: 'Globo negro',
      dataPos: '04375',
      talles: null,
      specs: ['Globo de látex'],
      tags: [],
      descripcion: null,
      fotos: [{ src: 'productos/globo-negro.jpg', cap: '' }]
    };
    const fila = filaProducto(tarjeta, null, familiaPorCodigo);
    expect(fila).toMatchObject({
      pagina: 'globos-fiesta-v2.html',
      slug: 'globo-negro',
      titulo: 'Globo negro',
      codigo: '04375',
      variantes: null,
      publicado: true,
      familia: 'GLOBOS',
      subcategoria_id: null
    });
  });

  it('overlay oculta=true -> publicado=false', () => {
    const tarjeta = {
      pagina: 'globos-fiesta-v2.html', slug: 'x', titulo: 'X', dataPos: '04375',
      talles: null, specs: [], tags: [], descripcion: null, fotos: []
    };
    const fila = filaProducto(tarjeta, { oculta: true }, familiaPorCodigo);
    expect(fila.publicado).toBe(false);
  });

  it('overlay con codigo_override reemplaza el data-pos y afecta la familia resuelta', () => {
    const tarjeta = {
      pagina: 'p.html', slug: 'x', titulo: 'X', dataPos: '00000',
      talles: null, specs: [], tags: [], descripcion: null, fotos: []
    };
    const fila = filaProducto(tarjeta, { codigo_override: '04375' }, familiaPorCodigo);
    expect(fila.codigo).toBe('04375');
    expect(fila.familia).toBe('GLOBOS');
  });

  it('producto de talles: codigo null, variantes armadas como {talle, codigo, activo}', () => {
    const tarjeta = {
      pagina: 'p.html', slug: 'x', titulo: 'X', dataPos: '',
      talles: [{ label: 'Chico', code: '04375' }],
      specs: [], tags: [], descripcion: null, fotos: []
    };
    const fila = filaProducto(tarjeta, null, familiaPorCodigo);
    expect(fila.codigo).toBeNull();
    expect(fila.variantes).toEqual([{ talle: 'Chico', codigo: '04375', activo: true }]);
    expect(fila.familia).toBe('GLOBOS');
  });

  it('specs/tags vacíos se guardan como null, no como array vacío', () => {
    const tarjeta = {
      pagina: 'p.html', slug: 'x', titulo: 'X', dataPos: '04375',
      talles: null, specs: [], tags: [], descripcion: null, fotos: []
    };
    const fila = filaProducto(tarjeta, null, familiaPorCodigo);
    expect(fila.specs).toBeNull();
    expect(fila.tags).toBeNull();
  });
});
