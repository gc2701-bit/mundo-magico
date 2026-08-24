'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { PASS_MIN, validarPass, mensajeDeError } from '@/lib/cuenta';

/**
 * Porteo de assets/recuperar.js (sitio viejo). El original usaba
 * window.MMCuenta (assets/cuenta.js) para no crear un segundo cliente de
 * Supabase Auth compitiendo por el mismo storage — acá el mismo criterio
 * se resuelve reusando supabaseBrowser() (mismo cliente que ya usa el
 * resto del sitio Next.js) y escuchando el evento PASSWORD_RECOVERY
 * directo, sin depender del JS vanilla viejo.
 *
 * Al abrir el link del correo de resetPasswordForEmail, el SDK procesa el
 * token del hash de la URL y dispara ese evento una sola vez, con una
 * sesión temporal que sólo sirve para llamar a updateUser({password}). Si
 * no llega en unos segundos, el link no es válido (expiró, ya se usó, o
 * se abrió la página directo sin pasar por el correo) — mismo timeout de
 * 5s que el original.
 */
type Vista = 'esperando' | 'invalido' | 'form' | 'listo';

export default function RecuperarForm() {
  const [vista, setVista] = useState<Vista>('esperando');
  const [pass, setPass] = useState('');
  const [passConf, setPassConf] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let recuperando = false;

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recuperando = true;
        setVista('form');
      }
    });

    const timeout = setTimeout(() => {
      if (!recuperando) setVista('invalido');
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (vista === 'form') passRef.current?.focus();
  }, [vista]);

  async function guardar() {
    const errPass = validarPass(pass);
    if (errPass) {
      setError(errPass);
      passRef.current?.focus();
      return;
    }
    if (pass !== passConf) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    setGuardando(true);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.updateUser({ password: pass });
    setGuardando(false);
    if (err) {
      setError(mensajeDeError(err));
      return;
    }
    setVista('listo');
  }

  return (
    <div className="rec-wrap">
      <div className="rec-card">
        {vista === 'esperando' && (
          <div>
            <h1>Un momento…</h1>
            <p>Confirmando el link de recuperación.</p>
          </div>
        )}

        {vista === 'invalido' && (
          <div>
            <h1>Este link ya no es válido</h1>
            <p>
              Puede haber expirado o ya haberse usado. Volvé a la web y pedí uno nuevo desde &quot;Olvidé mi
              contraseña&quot;, en el ícono de tu cuenta.
            </p>
          </div>
        )}

        {vista === 'form' && (
          <div>
            <h1>Elegí tu contraseña nueva</h1>
            <p>Esta va a ser tu nueva contraseña para entrar a tu cuenta.</p>
            <label className="cart-field">
              <span>Contraseña nueva</span>
              <input
                ref={passRef}
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </label>
            <small className="cart-field-hint">
              Al menos {PASS_MIN} caracteres, con una mayúscula y un carácter especial (ej: !@#$%).
            </small>
            <label className="cart-field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={passConf}
                onChange={(e) => setPassConf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardar();
                }}
              />
            </label>
            {error && <p className="cart-acc-error">{error}</p>}
            <button type="button" className="cart-send" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </div>
        )}

        {vista === 'listo' && (
          <div className="rec-ok">
            <h1>Listo</h1>
            <p>Tu contraseña se actualizó. Ya podés volver a la web.</p>
            <a href="/">Ir a Mundo Mágico</a>
          </div>
        )}
      </div>
    </div>
  );
}
