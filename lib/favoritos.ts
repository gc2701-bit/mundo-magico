/**
 * Favoritos de cliente — portado de public/assets/carrito.js (viven en
 * localStorage, no dependen de tener sesión iniciada). Se separa en su
 * propio módulo porque el panel "Mis favoritos" (accesible desde el menú
 * de cuenta, Sprint 5 Task 5.1) no necesita esperar al carrito/producto
 * (Task 5.2) para existir — el corazón en cada ProductoCard se conecta ahí.
 */

const LSF = 'mm_favoritos_v1';

export type Favorito = { title: string; img: string; url: string };
export type Favoritos = Record<string, Favorito>;

export function claveFavorito(categoria: string, titulo: string): string {
  return `${categoria || ''}::${titulo}`;
}

export function cargarFavoritos(storage: Pick<Storage, 'getItem'> = localStorage): Favoritos {
  try {
    const raw = storage.getItem(LSF);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function guardarFavoritos(favoritos: Favoritos, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(LSF, JSON.stringify(favoritos));
  } catch {
    /* modo privado */
  }
}

export function toggleFavorito(favoritos: Favoritos, clave: string, datos: Favorito): Favoritos {
  const siguiente = { ...favoritos };
  if (siguiente[clave]) delete siguiente[clave];
  else siguiente[clave] = datos;
  return siguiente;
}

export function listaFavoritos(favoritos: Favoritos): Favorito[] {
  return Object.values(favoritos);
}
