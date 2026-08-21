'use client';

import { useEffect, useState } from 'react';
import { useCuenta, type AjustesTab } from './CuentaProvider';
import { PASS_MIN, validarPass, fuerzaPassword, mensajeDeError, direccionDe, nombreDe, telefonoDe, fechaLegible, ESTADOS_TXT } from '@/lib/cuenta';

type Pedido = {
  id: string | number;
  created_at: string;
  items?: { q: number; t: string; v?: string }[];
  metodo_entrega?: string;
  zona?: string;
  direccion?: string;
  entrega?: string;
  fecha_entrega?: string;
  estado?: string;
};

/**
 * Ajustes de la cuenta — puerto de armarModalAjustes() de assets/cuenta.js
 * (Sprint 5, Task 5.1): datos de contacto, cambiar contraseña, cambiar
 * email, historial de pedidos y borrado de cuenta.
 */
export default function AjustesModal() {
  const { sb, sesion, ajustesAbierto, tabAjustes, irAAjustesTab, cerrarAjustes, cerrarSesion } = useCuenta();

  useEffect(() => {
    if (!ajustesAbierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrarAjustes(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ajustesAbierto, cerrarAjustes]);

  const tabs: { id: AjustesTab; label: string }[] = [
    { id: 'datos', label: 'Datos' },
    { id: 'pass', label: 'Contraseña' },
    { id: 'email', label: 'Email' },
    { id: 'pedidos', label: 'Pedidos' },
  ];

  return (
    <div className={'cart-acc' + (ajustesAbierto ? ' is-on' : '')} role="dialog" aria-modal="true" aria-label="Ajustes de la cuenta">
      <div className="cart-head">
        <h2>Ajustes de la cuenta</h2>
        <button type="button" className="cart-x" aria-label="Cerrar" onClick={cerrarAjustes}>×</button>
      </div>
      <div className="cart-acc-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={'cart-acc-tab' + (tabAjustes === t.id ? ' is-on' : '')} onClick={() => irAAjustesTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="cart-acc-body">
        <DatosTab sb={sb} sesion={sesion} visible={tabAjustes === 'datos'} onCuentaBorrada={cerrarSesion} onCerrar={cerrarAjustes} />
        <PassTab sb={sb} sesion={sesion} visible={tabAjustes === 'pass'} />
        <EmailTab sb={sb} sesion={sesion} visible={tabAjustes === 'email'} />
        <PedidosTab sb={sb} sesion={sesion} visible={tabAjustes === 'pedidos'} />
      </div>
    </div>
  );
}

type Sesion = ReturnType<typeof useCuenta>['sesion'];
type Sb = ReturnType<typeof useCuenta>['sb'];
type TabProps = { sb: Sb; sesion: Sesion; visible: boolean };

function DatosTab({ sb, sesion, visible, onCuentaBorrada, onCerrar }: TabProps & { onCuentaBorrada: () => Promise<void>; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(() => nombreDe(sesion));
  const [tel, setTel] = useState(() => telefonoDe(sesion));
  const [direccion, setDireccion] = useState(() => direccionDe(sesion));
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setNombre(nombreDe(sesion));
    setTel(telefonoDe(sesion));
    setDireccion(direccionDe(sesion));
    setError('');
    setOk('');
  }, [visible, sesion]);

  async function guardar() {
    setError(''); setOk('');
    setCargando(true);
    const r = await sb.auth.updateUser({ data: { nombre: nombre.trim(), telefono: tel.trim(), direccion: direccion.trim() } });
    setCargando(false);
    if (r.error) { setError(mensajeDeError(r.error)); return; }
    setOk('Tus datos se guardaron.');
  }

  // Borra la cuenta vía eliminar_mi_cuenta() (ver
  // supabase/envios_13_borrar_cuenta.sql): esa función sólo puede borrar
  // auth.uid(), nunca otra cuenta. Los pedidos ya hechos no se borran, sólo
  // pierden el vínculo con la cuenta.
  async function borrarCuenta() {
    if (!window.confirm('¿Borrar tu cuenta para siempre? No se puede deshacer. Vas a tener que crear una cuenta nueva para volver a comprar con inicio de sesión.')) return;
    setBorrando(true);
    setError('');
    const r = await sb.rpc('eliminar_mi_cuenta');
    if (r.error) {
      setBorrando(false);
      setError('No se pudo borrar la cuenta. Probá de nuevo.');
      return;
    }
    onCerrar();
    await onCuentaBorrada();
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <label className="cart-field"><span>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label className="cart-field"><span>Teléfono</span><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></label>
      <label className="cart-field"><span>Dirección de envío</span><input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
      {error && <p className="cart-acc-error">{error}</p>}
      {ok && <p className="cart-acc-ok">{ok}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={guardar}>{cargando ? 'Guardando…' : 'Guardar datos'}</button>
      <div className="cart-acc-borrar">
        <p className="cart-field-hint">Esto borra tu cuenta para siempre. No se puede deshacer.</p>
        <button type="button" className="cart-acc-borrar-btn" disabled={borrando} onClick={borrarCuenta}>{borrando ? 'Borrando…' : 'Borrar mi cuenta'}</button>
      </div>
    </div>
  );
}

function PassTab({ sb, sesion, visible }: TabProps) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [conf, setConf] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);
  const fuerza = fuerzaPassword(nueva);

  async function cambiar() {
    const errPass = validarPass(nueva);
    if (!actual) { setError('Ingresá tu contraseña actual.'); return; }
    if (errPass) { setError(errPass); return; }
    if (nueva !== conf) { setError('Las contraseñas nuevas no coinciden.'); return; }

    setError(''); setOk('');
    setCargando(true);
    // Reautenticación: Supabase no la exige para updateUser, pero sin esto
    // cualquiera con el navegador desbloqueado podría cambiar la
    // contraseña sin saber la actual.
    const email = sesion?.user?.email || '';
    const re = await sb.auth.signInWithPassword({ email, password: actual });
    if (re.error) {
      setCargando(false);
      setError('La contraseña actual no es correcta.');
      return;
    }
    const r = await sb.auth.updateUser({ password: nueva, current_password: actual });
    setCargando(false);
    if (r.error) { setError(mensajeDeError(r.error)); return; }
    setActual(''); setNueva(''); setConf('');
    setOk('Listo, tu contraseña se actualizó.');
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <label className="cart-field"><span>Contraseña actual</span><input type="password" value={actual} onChange={(e) => setActual(e.target.value)} /></label>
      <label className="cart-field">
        <span>Contraseña nueva</span>
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <small className="cart-field-hint">Al menos {PASS_MIN} caracteres, con una mayúscula y un carácter especial (ej: !@#$%).</small>
      </label>
      <div className="cart-pass-fuerza" hidden={!fuerza}>
        <div className="cart-pass-bar"><div className={'cart-pass-bar-fill' + (fuerza ? ' is-' + fuerza.nivel : '')} /></div>
        <small className="cart-pass-texto">{fuerza?.etiqueta}</small>
      </div>
      <label className="cart-field"><span>Confirmar contraseña nueva</span><input type="password" value={conf} onChange={(e) => setConf(e.target.value)} /></label>
      {error && <p className="cart-acc-error">{error}</p>}
      {ok && <p className="cart-acc-ok">{ok}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={cambiar}>{cargando ? 'Cambiando…' : 'Cambiar contraseña'}</button>
    </div>
  );
}

function EmailTab({ sb, sesion, visible }: TabProps) {
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cambiar() {
    if (!actual) { setError('Ingresá tu contraseña actual.'); return; }
    if (!nuevo.trim()) { setError('Ingresá el nuevo email.'); return; }

    setError(''); setOk('');
    setCargando(true);
    const email = sesion?.user?.email || '';
    const re = await sb.auth.signInWithPassword({ email, password: actual });
    if (re.error) {
      setCargando(false);
      setError('La contraseña actual no es correcta.');
      return;
    }
    const r = await sb.auth.updateUser({ email: nuevo.trim() });
    setCargando(false);
    if (r.error) { setError(mensajeDeError(r.error)); return; }
    setActual(''); setNuevo('');
    setOk('Te enviamos un correo de confirmación. El email de tu cuenta cambia recién cuando lo confirmes.');
  }

  return (
    <div className="cart-acc-group" hidden={!visible}>
      <label className="cart-field"><span>Contraseña actual</span><input type="password" value={actual} onChange={(e) => setActual(e.target.value)} /></label>
      <label className="cart-field"><span>Nuevo email</span><input type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} /></label>
      <small className="cart-field-hint">Te va a llegar un correo de confirmación (a la casilla actual y/o a la nueva). El cambio no se aplica hasta que lo confirmes.</small>
      {error && <p className="cart-acc-error">{error}</p>}
      {ok && <p className="cart-acc-ok">{ok}</p>}
      <button type="button" className="cart-send" disabled={cargando} onClick={cambiar}>{cargando ? 'Cambiando…' : 'Cambiar email'}</button>
    </div>
  );
}

function PedidosTab({ sb, sesion, visible }: TabProps) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible || !sesion) return;
    let cancelado = false;
    setPedidos(null);
    setError(false);
    sb.from('pedidos').select('*').eq('user_id', sesion.user.id).order('created_at', { ascending: false })
      .then((r: { data: Pedido[] | null; error: unknown }) => {
        if (cancelado) return;
        if (r.error) { setError(true); return; }
        setPedidos(r.data || []);
      }, () => { if (!cancelado) setError(true); });
    return () => { cancelado = true; };
  }, [visible, sesion, sb]);

  if (!visible) return null;
  if (error) return <div className="cart-acc-group"><p className="cart-acc-error">No se pudo cargar el historial de pedidos.</p></div>;
  if (pedidos === null) return <div className="cart-acc-group"><p className="cart-field-hint">Cargando…</p></div>;
  if (!pedidos.length) return <div className="cart-acc-group"><p className="cart-empty">Todavía no hiciste ningún pedido.</p></div>;

  return (
    <div className="cart-acc-group">
      {pedidos.map((p) => {
        const fecha = new Date(p.created_at);
        let entregaTxt = '';
        if (p.metodo_entrega === 'envio') {
          entregaTxt = 'Envío' + (p.zona ? ` — ${p.zona}` : '') + (p.direccion ? ` (${p.direccion})` : '');
        } else if (p.metodo_entrega) {
          entregaTxt = 'Retiro en el local';
        } else if (p.entrega) {
          entregaTxt = p.entrega;
        }
        return (
          <div className="ajustes-pedido" key={p.id}>
            <p className="ajustes-pedido-fecha">
              {fecha.toLocaleDateString('es-AR')} · {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <ul className="ajustes-pedido-items">
              {(p.items || []).map((it, i) => (
                <li key={i}>{it.q}x {it.t}{it.v ? ` — ${it.v}` : ''}</li>
              ))}
            </ul>
            {entregaTxt && <p className="ajustes-pedido-meta">Entrega: {entregaTxt}</p>}
            {p.fecha_entrega && <p className="ajustes-pedido-meta">Para: {fechaLegible(p.fecha_entrega)}</p>}
            {p.estado && <span className={'ajustes-pedido-estado ep-' + p.estado}>{ESTADOS_TXT[p.estado] || p.estado}</span>}
          </div>
        );
      })}
    </div>
  );
}
