'use client';

import { useEffect, useState } from 'react';
import { useCuenta } from './CuentaProvider';
import { cargarFavoritos, listaFavoritos, type Favorito } from '@/lib/favoritos';

/**
 * Panel "Mis favoritos" — lectura del localStorage portado en
 * lib/favoritos.ts (Sprint 5, Task 5.1). El corazón que ESCRIBE en cada
 * ProductoCard llega con el carrito (Task 5.2); este panel ya funciona hoy
 * mostrando lo que el cliente haya guardado desde el sitio viejo (misma
 * clave de localStorage, `mm_favoritos_v1`).
 */
export default function FavoritosPanel() {
  const { favoritosAbierto, cerrarFavoritos } = useCuenta();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);

  useEffect(() => {
    if (!favoritosAbierto) return;
    setFavoritos(listaFavoritos(cargarFavoritos()));
  }, [favoritosAbierto]);

  useEffect(() => {
    if (!favoritosAbierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrarFavoritos(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [favoritosAbierto, cerrarFavoritos]);

  return (
    <div className={'cart-acc' + (favoritosAbierto ? ' is-on' : '')} role="dialog" aria-modal="true" aria-label="Mis favoritos">
      <div className="cart-head">
        <h2>Mis favoritos</h2>
        <button type="button" className="cart-x" aria-label="Cerrar" onClick={cerrarFavoritos}>×</button>
      </div>
      <div className="cart-acc-body">
        {favoritos.length === 0 ? (
          <p className="cart-empty">Todavía no marcaste ningún favorito. Tocá el corazón de un producto para guardarlo acá.</p>
        ) : (
          <div className="cart-body">
            {favoritos.map((f, i) => (
              <a className="cart-item" href={f.url} key={i}>
                {f.img && <img src={f.img} alt="" loading="lazy" />}
                <div className="cart-item-in"><p className="cart-item-t">{f.title}</p></div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
