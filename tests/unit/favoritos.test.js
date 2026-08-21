/* lib/favoritos.ts — lógica pura del panel "Mis favoritos" (Sprint 5, Task
 * 5.1), portada de la parte de favoritos de assets/carrito.js. El corazón
 * en cada ProductoCard que ESCRIBE acá se conecta en Task 5.2 (carrito) —
 * este módulo ya deja lista la lectura/escritura/toggle en localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { claveFavorito, cargarFavoritos, guardarFavoritos, toggleFavorito, listaFavoritos } from '../../lib/favoritos';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('claveFavorito', () => {
  it('combina categoría y título', () => {
    expect(claveFavorito('cotillon', 'Anteojo estrella')).toBe('cotillon::Anteojo estrella');
  });
});

describe('cargarFavoritos', () => {
  it('sin nada guardado, devuelve objeto vacío', () => {
    expect(cargarFavoritos(fakeStorage())).toEqual({});
  });

  it('JSON corrupto no rompe, devuelve objeto vacío', () => {
    const storage = fakeStorage();
    storage.setItem('mm_favoritos_v1', '{no es json');
    expect(cargarFavoritos(storage)).toEqual({});
  });

  it('lee lo guardado por guardarFavoritos', () => {
    const storage = fakeStorage();
    guardarFavoritos({ a: { title: 'X', img: 'x.jpg', url: '/x' } }, storage);
    expect(cargarFavoritos(storage)).toEqual({ a: { title: 'X', img: 'x.jpg', url: '/x' } });
  });
});

describe('toggleFavorito', () => {
  it('agrega si no existía', () => {
    const r = toggleFavorito({}, 'a', { title: 'X', img: '', url: '/x' });
    expect(r.a).toEqual({ title: 'X', img: '', url: '/x' });
  });

  it('saca si ya existía', () => {
    const r = toggleFavorito({ a: { title: 'X', img: '', url: '/x' } }, 'a', { title: 'X', img: '', url: '/x' });
    expect(r.a).toBeUndefined();
  });

  it('no muta el objeto original', () => {
    const original = {};
    toggleFavorito(original, 'a', { title: 'X', img: '', url: '/x' });
    expect(original).toEqual({});
  });
});

describe('listaFavoritos', () => {
  it('devuelve los valores como array', () => {
    const favs = { a: { title: 'X', img: '', url: '/x' }, b: { title: 'Y', img: '', url: '/y' } };
    expect(listaFavoritos(favs)).toEqual([favs.a, favs.b]);
  });
});
