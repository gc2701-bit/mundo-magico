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
 *
 * Rediseño Sprint 8 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * split con imagen del castillo en desktop, sólo el formulario en mobile
 * (pedido explícito del plan) — Tailwind en vez de `cuenta.css`. Sigue
 * SIEMPRE montado (nunca `{modalAbierto && (...)}`) por el motivo de
 * Turnstile de arriba — la visibilidad es puramente CSS (opacity/scale),
 * mismo criterio que el `translate` de CarritoPanel.tsx en Sprint 7.
 *
 * AjustesModal.tsx/FavoritosPanel.tsx quedan con su modal chico legacy
 * por ahora — no estaban en el pedido explícito de este sprint (sólo
 * "Cuenta: login/registro"). Van en el Sprint 9 (QA visual/limpieza),
 * cuando de cualquier forma se retira `cuenta.css` del todo.
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

  const titulo = tabModal === 'signup' ? 'Creá tu cuenta' : tabModal === 'login' ? 'Ya tengo cuenta' : 'Recuperar contraseña';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mi cuenta"
      className={
        'fixed inset-0 z-[1500] flex items-center justify-center p-s3 transition-opacity duration-200 ' +
        (modalAbierto ? 'opacity-100' : 'pointer-events-none opacity-0')
      }
    >
      <div
        className={
          'flex w-full max-w-3xl overflow-hidden rounded-brand bg-surface shadow-xl transition-transform duration-200 ' +
          (modalAbierto ? 'scale-100' : 'scale-95')
        }
      >
        {/* Imagen del castillo — sólo desktop, pedido explícito del plan */}
        <div className="hidden w-2/5 shrink-0 flex-col items-center justify-center gap-s3 bg-green-soft p-s5 md:flex">
          <img src="/Logo/Mundo-Magico%20Logo.jpg" alt="" aria-hidden="true" width={140} height={140} className="w-36 rounded-full shadow-md" />
          <p className="text-center font-display text-fs2 italic text-green-ink">Todo para tu fiesta, en un solo lugar</p>
        </div>

        <div className="flex max-h-[90vh] flex-1 flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line px-s4 py-s3">
            <h2 className="font-display text-fs2 text-ink">{titulo}</h2>
            <button type="button" aria-label="Cerrar" onClick={cancelar} className="flex h-9 w-9 items-center justify-center rounded-full font-body text-fs1 text-ink hover:bg-background-alt">×</button>
          </div>
          {tabModal !== 'recuperar' && (
            <div className="flex border-b border-line">
              <button
                type="button"
                onClick={() => irATab('signup')}
                className={'flex-1 border-b-2 px-s3 py-s2 font-body text-fs0 font-semibold ' + (tabModal === 'signup' ? 'border-green text-ink' : 'border-transparent text-muted')}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => irATab('login')}
                className={'flex-1 border-b-2 px-s3 py-s2 font-body text-fs0 font-semibold ' + (tabModal === 'login' ? 'border-green text-ink' : 'border-transparent text-muted')}
              >
                Ya tengo cuenta
              </button>
            </div>
          )}
          <div className="flex flex-col gap-s3 px-s4 py-s4">
            <SignupForm sb={sb} visible={tabModal === 'signup'} onExito={alExito} />
            <LoginForm sb={sb} visible={tabModal === 'login'} onExito={alExito} onRecuperar={() => irATab('recuperar')} />
            <RecuperarForm sb={sb} visible={tabModal === 'recuperar'} onVolver={() => irATab('login')} />
          </div>
        </div>
      </div>
    </div>
  );
}

type FormProps = { sb: ReturnType<typeof useCuenta>['sb'] };

const campo = 'rounded-brand border border-line px-s3 py-s2 font-body text-fs0 text-ink';
const etiqueta = 'font-body text-fs-1 text-muted';
const hint = 'font-body text-fs-1 text-muted';
const error_ = 'font-body text-fs-1 text-red-ink!';
const ok_ = 'font-body text-fs-1 text-green-ink!';
const boton = 'rounded-brand bg-green px-s4 py-s3 text-center font-body text-fs0 font-semibold text-white! disabled:opacity-60';
const link = 'text-center font-body text-fs-1 font-semibold text-green-ink! underline';

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
    <div className="flex flex-col gap-s3" hidden={!visible}>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Teléfono (opcional)</span><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Contraseña</span>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className={campo} />
        <small className={hint}>Al menos {PASS_MIN} caracteres, con una mayúscula y un carácter especial (ej: !@#$%).</small>
      </label>
      {fuerza && (
        <div className="flex items-center gap-s2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className={'h-full rounded-full ' + (fuerza.nivel === 'debil' ? 'w-1/3 bg-red-ink' : fuerza.nivel === 'media' ? 'w-2/3 bg-orange-ink' : 'w-full bg-green')}
            />
          </div>
          <small className="font-body text-fs-1 text-muted">{fuerza.etiqueta}</small>
        </div>
      )}
      <label className="flex flex-col gap-1"><span className={etiqueta}>Confirmar contraseña</span><input type="password" value={passConf} onChange={(e) => setPassConf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} className={campo} /></label>
      <div ref={tw.contRef} className="my-1" />
      {error && <p className={error_}>{error}</p>}
      {ok && <p className={ok_}>{ok}</p>}
      <button type="button" disabled={cargando} onClick={enviar} className={boton}>{cargando ? 'Creando cuenta…' : 'Crear cuenta y continuar'}</button>
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
    <div className="flex flex-col gap-s3" hidden={!visible}>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} /></label>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Contraseña</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} className={campo} /></label>
      <div ref={tw.contRef} className="my-1" />
      {error && <p className={error_}>{error}</p>}
      <button type="button" disabled={cargando} onClick={enviar} className={boton}>{cargando ? 'Ingresando…' : 'Iniciar sesión y continuar'}</button>
      <button type="button" onClick={onRecuperar} className={link}>¿Olvidaste tu contraseña?</button>
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
    <div className="flex flex-col gap-s3" hidden={!visible}>
      <p className={hint}>Ingresá tu email y te mandamos un link para elegir una contraseña nueva.</p>
      <label className="flex flex-col gap-1"><span className={etiqueta}>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} className={campo} /></label>
      <div ref={tw.contRef} className="my-1" />
      {error && <p className={error_}>{error}</p>}
      {ok && <p className={ok_}>{ok}</p>}
      <button type="button" disabled={cargando} onClick={enviar} className={boton}>{cargando ? 'Enviando…' : 'Mandar link'}</button>
      <button type="button" onClick={onVolver} className={link}>Volver</button>
    </div>
  );
}
