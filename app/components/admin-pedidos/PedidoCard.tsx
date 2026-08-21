'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ESTADOS, ESTADOS_TXT, MOTIVOS_AUSENTE, MOTIVOS_AUSENTE_TXT, siguientes, telWa, fechaLegible, isodow, type DatosEnvios } from '@/lib/envios';
import { esAtrasado, diasAtraso, esTraslado, bultosDe, sugerirFechaEnvio, type Pedido, type PedidoEvento } from '@/lib/pedidos-admin';

type Props = {
  sb: SupabaseClient;
  pedido: Pedido;
  datosEnvios: DatosEnvios | null;
  onActualizar: (p: Pedido) => void;
  onAvisar: (p: Pedido) => void;
};

/**
 * Tarjeta de un pedido — puerto de tarjeta()/bloqueEstado()/bloqueHistoria()/
 * bloqueFechaEnvio()/bloqueTamano() de admin-pedidos.js (Sprint 5, Task
 * 5.3). No incluye la barra de "plan de reparto" (flechas de orden,
 * repartidor, firma de recibido) — ver nota de alcance en
 * lib/pedidos-admin.ts.
 */
export default function PedidoCard({ sb, pedido: p, datosEnvios, onActualizar, onAvisar }: Props) {
  const traslado = esTraslado(p);
  const atrasado = esAtrasado(p);

  const partes: string[] = [];
  if (traslado) {
    const sucOrigen = datosEnvios?.sucursales.find((s) => s.id === p.sucursal_id);
    partes.push('Retiro en ' + (sucOrigen ? sucOrigen.nombre : 'sucursal con traslado'));
  } else {
    partes.push(p.metodo_entrega === 'envio' ? 'Envío' : 'Retiro');
  }
  if (p.metodo_entrega === 'envio' && (p.zona_nombre || p.zona)) partes.push(p.zona_nombre || p.zona || '');
  if (p.metodo_entrega === 'envio' && p.direccion) partes.push(p.direccion);
  if (p.entre_calles) partes.push('entre ' + p.entre_calles);
  if (p.piso_depto) partes.push(p.piso_depto);
  if (p.fecha_entrega) partes.push('Para el ' + fechaLegible(p.fecha_entrega));

  const consultaMaps = p.metodo_entrega === 'envio' && p.direccion
    ? `${p.direccion}${p.entre_calles ? ' entre ' + p.entre_calles : ''}${p.zona_nombre || p.zona ? ', ' + (p.zona_nombre || p.zona) : ''}, Tucumán, Argentina`
    : null;

  return (
    <div className={'adm-card' + (traslado ? ' is-traslado' : '')}>
      <div className="adm-card-top">
        <b>{p.nombre || 'Sin nombre'}</b>
        {p.numero != null && <span className="adm-card-numero">{'#' + p.numero}</span>}
        {traslado && <span className="adm-card-traslado-tag">Traslado</span>}
        {p.envio_inmediato && <span className="adm-card-inmediato-tag">Envío inmediato</span>}
        {atrasado && <span className="adm-card-atrasado-tag">{`Atrasado ${diasAtraso(p)} día${diasAtraso(p) > 1 ? 's' : ''}`}</span>}
        {p.telefono && (
          <a className="adm-card-tel" href={'https://wa.me/' + telWa(p.telefono)} target="_blank" rel="noopener">{p.telefono}</a>
        )}
      </div>

      <p className="adm-card-meta">{partes.join(' · ')}</p>
      {consultaMaps && (
        <a className="adm-card-maps" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consultaMaps)} target="_blank" rel="noopener">
          Ver en Google Maps
        </a>
      )}
      {p.receptor_nombre && (
        <p className="adm-card-meta">{'Lo recibe: ' + p.receptor_nombre + (p.receptor_telefono ? ` (${p.receptor_telefono})` : '')}</p>
      )}

      <ul className="adm-card-items">
        {(p.items || []).map((it, i) => (
          <li key={i}>{`${it.q}x ${it.t}${it.v ? ' — ' + it.v : ''}${it.c ? ` [${it.c}]` : ''}`}</li>
        ))}
      </ul>

      <BloqueTamano sb={sb} pedido={p} onActualizar={onActualizar} />

      {p.nota && <p className="adm-card-nota">{p.nota}</p>}

      {p.metodo_entrega === 'envio' && (
        <BloqueFechaEnvio sb={sb} pedido={p} datosEnvios={datosEnvios} onActualizar={onActualizar} />
      )}

      <div className="adm-card-foot">
        <span className="adm-card-creado">{'Pedido el ' + new Date(p.created_at).toLocaleDateString('es-AR')}</span>
      </div>

      <BloqueEstado pedido={p} datosEnvios={datosEnvios} sb={sb} onActualizar={onActualizar} />
      {p.telefono && (
        <button type="button" className="adm-card-avisar" onClick={() => onAvisar(p)}>Avisar por WhatsApp</button>
      )}
      <BloqueHistoria sb={sb} pedidoId={p.id} />
    </div>
  );
}

function BloqueTamano({ sb, pedido: p, onActualizar }: { sb: SupabaseClient; pedido: Pedido; onActualizar: (p: Pedido) => void }) {
  const [guardando, setGuardando] = useState(false);

  async function cambiar(valor: string) {
    setGuardando(true);
    const { error } = await sb.from('pedidos').update({ bultos: valor || null }).eq('id', p.id);
    setGuardando(false);
    if (error) { window.alert('No se pudo guardar el tamaño.'); return; }
    onActualizar({ ...p, bultos: (valor || null) as Pedido['bultos'] });
  }

  return (
    <select className="adm-card-tamano-sel" value={p.bultos || ''} disabled={guardando} onChange={(e) => cambiar(e.target.value)}>
      <option value="">Tamaño: sin clasificar</option>
      <option value="chico">Chico</option>
      <option value="mediano">Mediano</option>
      <option value="grande">Grande</option>
    </select>
  );
}

function BloqueFechaEnvio({ sb, pedido: p, datosEnvios, onActualizar }: { sb: SupabaseClient; pedido: Pedido; datosEnvios: DatosEnvios | null; onActualizar: (p: Pedido) => void }) {
  const [fecha, setFecha] = useState(p.fecha_entrega || '');
  const [franjaId, setFranjaId] = useState(p.franja_id || '');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (p.fecha_entrega || !datosEnvios) return;
    let cancelado = false;
    sugerirFechaEnvio(sb, p, datosEnvios).then((f) => {
      if (!cancelado && f) setFecha((actual) => actual || f);
    });
    return () => { cancelado = true; };
    // Sólo corre una vez al montar (o si cambian datosEnvios) — no se
    // vuelve a sugerir cada vez que el admin toca la fecha a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosEnvios]);

  const franjas = datosEnvios && fecha ? datosEnvios.franjas.filter((f) => f.dias_semana.includes(isodow(fecha))) : [];

  async function guardar() {
    if (!fecha || !franjaId) { window.alert('Elegí fecha y franja.'); return; }
    setGuardando(true);
    const { error } = await sb.from('pedidos').update({ fecha_entrega: fecha, franja_id: franjaId }).eq('id', p.id);
    setGuardando(false);
    if (error) { window.alert('No se pudo guardar la fecha.'); return; }
    onActualizar({ ...p, fecha_entrega: fecha, franja_id: franjaId });
  }

  return (
    <div className="adm-card-fecha">
      <span className="adm-card-fecha-label">{p.fecha_entrega ? 'Fecha/franja asignada' : 'Asignar fecha/franja (sugerida)'}</span>
      <input type="date" className="adm-card-fecha-in" value={fecha} onChange={(e) => { setFecha(e.target.value); setFranjaId(''); }} />
      <select className="adm-card-fecha-franja" value={franjaId} onChange={(e) => setFranjaId(e.target.value)}>
        <option value="">{fecha ? (franjas.length ? 'Elegí una franja…' : 'Sin franjas ese día') : 'Elegí una fecha primero'}</option>
        {franjas.map((f) => (
          <option key={f.id} value={f.id}>{`${f.nombre} (${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)})`}</option>
        ))}
      </select>
      <button type="button" className="adm-card-fecha-guardar" disabled={guardando} onClick={guardar}>Guardar</button>
    </div>
  );
}

function BloqueEstado({ pedido: p, datosEnvios, sb, onActualizar }: { pedido: Pedido; datosEnvios: DatosEnvios | null; sb: SupabaseClient; onActualizar: (p: Pedido) => void }) {
  const [modo, setModo] = useState<'normal' | 'motivo' | 'corregir'>('normal');
  const [motivo, setMotivo] = useState<string>(MOTIVOS_AUSENTE[0]);
  const [guardando, setGuardando] = useState(false);

  const pasos = siguientes(p.estado, p.metodo_entrega, p.sucursal_id, datosEnvios?.sucursales || []);

  async function actualizar(nuevo: string, extra?: Record<string, unknown>) {
    setGuardando(true);
    const { error } = await sb.from('pedidos').update({ estado: nuevo, ...(extra || {}) }).eq('id', p.id);
    setGuardando(false);
    if (error) { window.alert('No se pudo actualizar el estado.'); return; }
    onActualizar({ ...p, estado: nuevo, ...(extra || {}) });
    setModo('normal');
  }

  return (
    <div className="adm-card-paso-wrap">
      <span className={'adm-card-estado-actual ep-' + p.estado}>{ESTADOS_TXT[p.estado] || p.estado}</span>

      {modo === 'normal' && (
        <>
          <div className="adm-card-pasos">
            {pasos.map((destino) => (
              <button key={destino} type="button" className="adm-card-paso" disabled={guardando}
                onClick={() => (destino === 'ausente' ? setModo('motivo') : actualizar(destino))}>
                {ESTADOS_TXT[destino] || destino}
              </button>
            ))}
          </div>
          <button type="button" className="adm-card-corregir" onClick={() => setModo('corregir')}>Corregir estado</button>
        </>
      )}

      {modo === 'motivo' && (
        <div className="adm-card-pasos">
          <select className="adm-card-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS_AUSENTE.map((m) => <option key={m} value={m}>{MOTIVOS_AUSENTE_TXT[m] || m}</option>)}
          </select>
          <button type="button" className="adm-card-paso" disabled={guardando} onClick={() => actualizar('ausente', { motivo_ausente: motivo })}>Confirmar</button>
          <button type="button" className="adm-card-corregir" onClick={() => setModo('normal')}>Cancelar</button>
        </div>
      )}

      {modo === 'corregir' && (
        <div className="adm-card-pasos">
          <select className="adm-card-corregir-sel" defaultValue={p.estado} disabled={guardando} onChange={(e) => actualizar(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADOS_TXT[e]}</option>)}
          </select>
          <button type="button" className="adm-card-corregir" onClick={() => setModo('normal')}>Volver</button>
        </div>
      )}
    </div>
  );
}

function BloqueHistoria({ sb, pedidoId }: { sb: SupabaseClient; pedidoId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<PedidoEvento[] | null>(null);

  async function alTocar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (!siguiente || eventos !== null) return;
    const { data } = await sb.from('pedido_eventos').select('*').eq('pedido_id', pedidoId).order('created_at', { ascending: true });
    setEventos(data || []);
  }

  return (
    <div className="adm-card-historia-wrap">
      <button type="button" className="adm-card-historia-btn" onClick={alTocar}>Ver historial</button>
      {abierto && (
        <div className="adm-card-historia">
          {eventos === null ? (
            <p className="adm-card-historia-item">Cargando…</p>
          ) : eventos.length === 0 ? (
            <p className="adm-card-historia-item">Sin cambios registrados todavía.</p>
          ) : (
            eventos.map((ev) => {
              const linea = (ev.estado_anterior ? `${ESTADOS_TXT[ev.estado_anterior] || ev.estado_anterior} → ` : '') + (ESTADOS_TXT[ev.estado_nuevo] || ev.estado_nuevo);
              const cuando = new Date(ev.created_at).toLocaleString('es-AR');
              return <p className="adm-card-historia-item" key={ev.id}>{`${linea}${ev.motivo ? ' (' + ev.motivo + ')' : ''} · ${cuando}${ev.actor_email ? ' — ' + ev.actor_email : ''}`}</p>;
            })
          )}
        </div>
      )}
    </div>
  );
}
