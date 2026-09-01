/* lib/slug.ts — utilidad genérica de slug, extraída del cuerpo de
 * slugifyMundo (lib/catalogo-mundo.ts) para no triplicar la misma lógica
 * de NFD + strip de diacríticos en EspejoTab.tsx y ProductoEditModal.tsx
 * (ver tasks/plan-activar-invalid-key.md, Sprint 0).
 */
import { describe, it, expect } from 'vitest';
import { slugify } from '../../lib/slug.ts';

describe('slugify', () => {
  it('minúscula, sin tildes, espacios a guión', () => {
    expect(slugify('Piñatas Grandes')).toBe('pinatas-grandes');
  });

  it('acentos y ñ', () => {
    expect(slugify('Decoración')).toBe('decoracion');
  });

  it('código de POS con ñ (caso que rompía Invalid key en Supabase Storage)', () => {
    expect(slugify('MOÑOLUZ')).toBe('monoluz');
  });

  it('símbolos sueltos se vuelven guión, sin guiones al borde', () => {
    expect(slugify('Anteojo #59521 (rojo)')).toBe('anteojo-59521-rojo');
  });

  it('string vacío o undefined da string vacío', () => {
    expect(slugify('')).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});
