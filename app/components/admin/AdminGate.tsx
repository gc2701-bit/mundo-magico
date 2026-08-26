'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { useTurnstile } from './useTurnstile';

type Estado = 'cargando' | 'sin-sesion' | 'no-admin' | 'admin';

/**
 * Gate de UI (NO es la barrera de seguridad real — esa la ponen las
 * políticas RLS, ver supabase/catalogo_*.sql) para /admin/catalogo.
 *
 * Login mínimo (email + contraseña + Turnstile — Supabase Auth exige el
 * captcha, sin esto el login no funciona en absoluto) — el modal completo
 * de cuenta (MMCuenta: alta, recuperar contraseña) todavía no existe en
 * Next, se porta recién en el Sprint 5. Esto es suficiente para que un
 * admin ya registrado pueda entrar a administrar el catálogo mientras
 * tanto.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const turnstile = useTurnstile();

  useEffect(() => {
    const sb = supabaseBrowser();

    async function chequear() {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setEstado('sin-sesion');
        return;
      }
      const { data: esAdmin, error: err } = await sb.rpc('es_admin');
      setEstado(!err && esAdmin ? 'admin' : 'no-admin');
    }

    chequear();
    const { data: sub } = sb.auth.onAuthStateChange(() => chequear());
    return () => sub.subscription.unsubscribe();
  }, []);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!turnstile.token) {
      setError('Esperá un instante (verificación anti-robots) y probá de nuevo.');
      return;
    }
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstile.token }
    });
    turnstile.reset();
    if (err) setError(err.message);
  }

  if (estado === 'cargando') return null;

  if (estado === 'admin') {
    return (
      <div className="adm-wrap adm-wrap-catalogo">
        <div className="adm-head">
          <h1>Catálogo</h1>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Catálogo</h1>
      </div>
      <div className="adm-gate">
        {estado === 'no-admin' ? (
          <p>Esta cuenta no tiene permisos de administrador.</p>
        ) : (
          <>
            <p>Necesitás iniciar sesión con la cuenta del negocio para administrar el catálogo.</p>
            <form onSubmit={iniciarSesion} className="adm-detalle-campos-editables">
              <div className="adm-detalle-campo">
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
              </div>
              <div className="adm-detalle-campo">
                <label>
                  Contraseña
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
              </div>
              <div ref={turnstile.contRef} />
              {error && <p className="adm-msg adm-msg-error">{error}</p>}
              <button type="submit" className="btn btn-primary">
                Iniciar sesión
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
