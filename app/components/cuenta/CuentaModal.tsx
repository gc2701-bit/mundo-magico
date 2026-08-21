'use client';

import { useEffect, useState } from 'react';
import { useCuenta } from './CuentaProvider';
import { useTurnstile } from '../admin/useTurnstile';
import { PASS_MIN, validarPass, fuerzaPassword, mensajeDeError } from '@/lib/cuenta';

/**
 * Modal de alta/login/recuperar contraseña — puerto de armarModal() de
 * assets/cuenta.js (Sprint 5, Task 5.1). Los tres formularios quedan
 * siempre montados (uno visible por vez, como el original) para que los
 * tres widgets de Turnstile estén listos apenas se abre el modal.
 */
export default function CuentaModal() {
  const { sb, modalAbierto, tabModal, irATab, cerrarModal, tomarPendiente } = useCuenta();

  useEffect(() => {
    if (!modalAbierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cancelar(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAbierto]);

  function cancelar() {
    tomarPendiente();
    cerrarModal();
  }

  function alExito() {
    const cb = tomarPendiente();
    cerrarModal();
    if (cb) cb();
  }

  return (
    <div className={'cart-acc' + (modalAbierto ? ' is-on' : '')} role="dialog" aria-modal="true" aria-label="Mi cuenta">
      <div className="cart-head">
        <h2>{tabModal === 'signup' ? 'Creá tu cuenta' : tabModal === 'login' ? 'Ya tengo cuenta' : 'Recuperar contraseña'}</h2>
        <button type="button" className="cart-x" aria-label="Cerrar" onClick={cancelar}>×</button>
      </div>
      <div className="cart-acc-tabs">
        <button type="button" className={'cart-acc-tab' + (tabModal === 'signup' ? ' is-on' : '')} onClick={() => irATab('signup')}>Crear cuenta</button>
        <button type="button" className={'cart-acc-tab' + (tabModal !== 'signup' ? ' is-on' : '')} onClick={() => irATab('login')}>Ya tengo cuenta</button>
      </div>
      <div className="cart-acc-body">
        <SignupForm sb={sb} visible={tabModal === 'signup'} onExito={alExito} />
        <LoginForm sb={sb} visible={tabModal === 'login'} onExito={alExito} onRecuperar={() => irATab('recuperar')} />
        <RecuperarForm sb={sb} visible={tabModal === 'recuperar'} onVolver={() => irATab('login')} />
      </div>
    </div>
  );
}

type FormProps = { sb: ReturnType<typeof useCuenta>['sb'] };

function SignupForm({ sb, visible, onExito }: FormProps & { visible: boolean; onExito: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [pass, setPass] = useState('');
  const [passConf, setPassConf] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);
  const tw = useTurnstile();
  const fuerza = fuerzaPassword(pass);

  async function enviar() {
    setOk('');
    const n = nombre.trim();
    const em = email.trim();
    const errPass = validarPass(pass);
    if (!n) { setError('Falta tu nombre.'); return; }
    if (!em) { setError('Falta el email.'); return; }
    if (errPass) { setError(errPass); return; }
    if (pass !== passConf) { setError('Las contraseñas no coinciden.'); return; }
    if (!tw.token) { setError('Esperá un instante (verificación anti-robots) y probá de nuevo.'); return; }

    setError('');
    setCargando(true);
    const r = await sb.auth.signUp({
      email: em,
      password: pass,
      options: { data: { nombre: n, telefono: tel.trim() }, captchaToken: tw.token },
    });
    tw.reset();
    setCargando(false);
    if (r.error) { setError(mensajeDeError(r.error)); return; }
    if (!r.data?.session) {
      setError(`Te mandamos un correo a ${em} para confirmar tu cuenta. Confirmalo y volvé a entrar acá con "Ya tengo cuenta".`);
      return;
    }
    onExito();
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <label className="cart-field"><span>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label className="cart-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="cart-field"><span>Teléfono (opcional)</span><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></label>
      <label className="cart-field">
        <span>Contraseña</span>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <small className="cart-field-hint">Al menos {PASS_MIN} caracteres, con una mayúscula y un carácter especial (ej: !@#$%).</small>
      </label>
      <div className="cart-pass-fuerza" hidden={!fuerza}>
        <div className="cart-pass-bar"><div className={'cart-pass-bar-fill' + (fuerza ? ' is-' + fuerza.nivel : '')} /></div>
        <small className="cart-pass-texto">{fuerza?.etiqueta}</small>
      </div>
      <label className="cart-field"><span>Confirmar contraseña</span><input type="password" value={passConf} onChange={(e) => setPassConf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} /></label>
      <div className="cart-turnstile" ref={tw.contRef} />
      {error && <p className="cart-acc-error">{error}</p>}
      {ok && <p className="cart-acc-ok">{ok}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={enviar}>{cargando ? 'Creando cuenta…' : 'Crear cuenta y continuar'}</button>
    </div>
  );
}

function LoginForm({ sb, visible, onExito, onRecuperar }: FormProps & { visible: boolean; onExito: () => void; onRecuperar: () => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const tw = useTurnstile();

  async function enviar() {
    const em = email.trim();
    if (!em || !pass) { setError('Completá email y contraseña.'); return; }
    if (!tw.token) { setError('Esperá un instante (verificación anti-robots) y probá de nuevo.'); return; }

    setError('');
    setCargando(true);
    const r = await sb.auth.signInWithPassword({ email: em, password: pass, options: { captchaToken: tw.token } });
    tw.reset();
    setCargando(false);
    if (r.error) { setError(mensajeDeError(r.error)); return; }
    onExito();
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <label className="cart-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="cart-field"><span>Contraseña</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} /></label>
      <div className="cart-turnstile" ref={tw.contRef} />
      {error && <p className="cart-acc-error">{error}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={enviar}>{cargando ? 'Ingresando…' : 'Iniciar sesión y continuar'}</button>
      <button type="button" className="cart-acc-link" onClick={onRecuperar}>¿Olvidaste tu contraseña?</button>
    </div>
  );
}

function RecuperarForm({ sb, visible, onVolver }: FormProps & { visible: boolean; onVolver: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);
  const tw = useTurnstile();

  async function enviar() {
    const em = email.trim();
    if (!em) { setError('Falta el email.'); return; }
    if (!tw.token) { setError('Esperá un instante (verificación anti-robots) y probá de nuevo.'); return; }

    setError('');
    setOk('');
    setCargando(true);
    const redirectTo = window.location.origin + '/recuperar';
    const r = await sb.auth.resetPasswordForEmail(em, { redirectTo, captchaToken: tw.token });
    tw.reset();
    setCargando(false);
    // Mensaje siempre igual, exista o no la cuenta — salvo el límite de
    // intentos, que sí conviene mostrar tal cual.
    if (r.error && /rate limit|too many requests/i.test(r.error.message || '')) {
      setError(mensajeDeError(r.error));
      return;
    }
    setOk('Si esa dirección tiene una cuenta, te va a llegar un correo con el link para elegir una contraseña nueva.');
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <p className="cart-field-hint">Ingresá tu email y te mandamos un link para elegir una contraseña nueva.</p>
      <label className="cart-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} /></label>
      <div className="cart-turnstile" ref={tw.contRef} />
      {error && <p className="cart-acc-error">{error}</p>}
      {ok && <p className="cart-acc-ok">{ok}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={enviar}>{cargando ? 'Enviando…' : 'Mandar link'}</button>
      <button type="button" className="cart-acc-link" onClick={onVolver}>Volver</button>
    </div>
  );
}
