'use client';

import { useEffect, useRef, useState } from 'react';
import { useCuenta } from './CuentaProvider';
import { nombreDe, emailDe } from '@/lib/cuenta';

/**
 * Ícono de cuenta en el header — puerto de armarBotonNav()/pintarPop() de
 * assets/cuenta.js (Sprint 5, Task 5.1). Independiente del carrito: deja
 * crear una cuenta o entrar a la propia sin haber agregado nada al pedido.
 */
export default function CuentaNavButton() {
  const { sesion, esAdmin, pedirSesion, abrirAjustes, abrirFavoritos, cerrarSesion } = useCuenta();
  const [popAbierto, setPopAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popAbierto) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setPopAbierto(false); }
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [popAbierto]);

  function alTocar() {
    if (sesion) setPopAbierto((v) => !v);
    else pedirSesion();
  }

  return (
    <div className="cuenta-nav-wrap" ref={wrapRef}>
      <button
        type="button"
        className={'cuenta-nav' + (sesion ? ' is-on' : '')}
        aria-haspopup="true"
        aria-expanded={popAbierto}
        aria-label={sesion ? 'Mi cuenta' : 'Crear cuenta o iniciar sesión'}
        onClick={alTocar}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" /><path d="M4 20.2c0-4.3 3.6-7.2 8-7.2s8 2.9 8 7.2" />
        </svg>
      </button>
      {sesion && (
        <div className="cuenta-pop" hidden={!popAbierto} role="menu">
          <p className="cuenta-pop-who">
            <b>{nombreDe(sesion) || 'Tu cuenta'}</b>
            <span>{emailDe(sesion)}</span>
          </p>
          <button type="button" className="cuenta-pop-item" onClick={() => { setPopAbierto(false); abrirAjustes('datos'); }}>Ajustes</button>
          <button type="button" className="cuenta-pop-item" onClick={() => { setPopAbierto(false); abrirAjustes('pedidos'); }}>Mis pedidos</button>
          <button type="button" className="cuenta-pop-item" onClick={() => { setPopAbierto(false); abrirFavoritos(); }}>Mis favoritos</button>
          {esAdmin && (
            <a className="cuenta-pop-item cuenta-pop-admin" href="/admin/catalogo" role="menuitem">Catálogo</a>
          )}
          <button type="button" className="cuenta-pop-out" onClick={() => { setPopAbierto(false); cerrarSesion(); }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
