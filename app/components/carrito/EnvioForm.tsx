'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCarrito } from './CarritoProvider';
import { plata, fechaLegible, hoyISO, isodow, sumarDiasISO, mesCorto, franjasDelDia, distanciaKm, MOTIVO_TXT, nombreCorredor, cuposDisponibles, type DiaCupo } from '@/lib/envios';
import { useCuenta } from '../cuenta/CuentaProvider';

const UMBRAL_KM_ZONA = 7;

/**
 * Formulario de entrega — puerto de MMEnvioForm (assets/envio-form.js,
 * Sprint 5, Task 5.2). Sólo se muestra cuando ya hay datos de envíos
 * cargados (ver CarritoProvider); mientras tanto se comporta igual que el
 * carrito viejo sin `envio-form.js` cargado — el pedido igual se puede
 * armar y mandar apenas terminan de llegar.
 */
export default function EnvioForm() {
  const { datosEnvios, estadoEnvio, actualizarEnvio, elegirMetodo, activarEnvioInmediato, buscandoTurno } = useCarrito();
  const { sb } = useCuenta();

  const [dias, setDias] = useState<DiaCupo[]>([]);
  const [avisoDireccion, setAvisoDireccion] = useState<{ texto: string; lejos: boolean } | null>(null);
  const direccionRevisada = useRef('');

  const zona = useMemo(() => datosEnvios?.zonas.find((z) => z.id === estadoEnvio.zonaId) || null, [datosEnvios, estadoEnvio.zonaId]);
  const entregaPropia = !!datosEnvios?.config.entrega_propia;

  // Días disponibles para retiro (chips de fecha) — sólo retiro elige día a
  // mano; en envío el negocio asigna la fecha real después (salvo envío
  // inmediato, que resuelve su propio turno en CarritoProvider).
  useEffect(() => {
    if (!datosEnvios || estadoEnvio.metodo !== 'retiro') { setDias([]); return; }
    let cancelado = false;
    const desde = hoyISO();
    const hasta = sumarDiasISO(desde, (datosEnvios.config.horizonte_dias || 14) - 1);
    cuposDisponibles(sb, desde, hasta, null, estadoEnvio.sucursalId).then((d) => { if (!cancelado) setDias(d); });
    return () => { cancelado = true; };
  }, [sb, datosEnvios, estadoEnvio.metodo, estadoEnvio.sucursalId]);

  // Aviso (no bloqueante) si la dirección tipeada geocodifica lejos de la
  // zona elegida — mismo umbral y mismo criterio "no pude revisarlo nunca es
  // está mal" que revisarDireccion() en envio-form.js.
  function revisarDireccion() {
    const texto = estadoEnvio.direccion.trim();
    if (!zona || zona.lat == null || zona.lng == null || texto.length < 6) { setAvisoDireccion(null); return; }
    const clave = zona.id + '·' + texto;
    if (clave === direccionRevisada.current) return;
    direccionRevisada.current = clave;

    const consulta = `${texto}, Tucumán, Argentina`;
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=' + encodeURIComponent(consulta))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (clave !== direccionRevisada.current) return;
        if (!data || !data[0]) {
          setAvisoDireccion({ texto: 'No pudimos ubicarla automáticamente. Revisala con el link a Google Maps de abajo antes de confirmar.', lejos: false });
          return;
        }
        const dist = distanciaKm(zona.lat as number, zona.lng as number, Number(data[0].lat), Number(data[0].lon));
        if (dist > UMBRAL_KM_ZONA) {
          setAvisoDireccion({ texto: `Esa dirección parece estar lejos de "${zona.nombre}" (unos ${Math.round(dist)} km). Fijate si elegiste la zona correcta.`, lejos: true });
        } else {
          setAvisoDireccion(null);
        }
      })
      .catch(() => setAvisoDireccion(null));
  }

  const direccionLink = useMemo(() => {
    const texto = estadoEnvio.direccion.trim();
    if (texto.length < 4) return null;
    const consulta = `${texto}${zona?.nombre ? ', ' + zona.nombre : ''}, Tucumán, Argentina`;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
  }, [estadoEnvio.direccion, zona]);

  if (!datosEnvios) return null;

  const grupos = new Map<string, typeof datosEnvios.zonas>();
  datosEnvios.zonas.forEach((z) => {
    const g = grupos.get(z.grupo_ruta) || [];
    g.push(z);
    grupos.set(z.grupo_ruta, g);
  });

  const costo = entregaPropia && zona && datosEnvios.config.cobrar_envio
    ? (datosEnvios.tarifas.find((t) => t.id === zona.tarifa_id)?.costo || 0) + (estadoEnvio.envioInmediato ? Number(datosEnvios.config.costo_envio_inmediato || 0) : 0)
    : 0;

  const isodowFecha = estadoEnvio.fecha ? isodow(estadoEnvio.fecha) : null;
  const franjasDia = isodowFecha != null ? franjasDelDia(datosEnvios.franjas, isodowFecha) : [];

  return (
    <div className="cart-envio-form">
      <h3 className="cart-foot-t">Tus datos</h3>

      <label className="cart-field">
        <span>Nombre</span>
        <input type="text" placeholder="Tu nombre" value={estadoEnvio.nombre} onChange={(e) => actualizarEnvio({ nombre: e.target.value })} />
      </label>

      {/* Un <label> envolviendo dos botones les concatena el texto del label
          a los DOS como accessible name (ambigüedad de a11y/testing) — por
          eso acá es un <div>, no <label>, a diferencia de los campos de
          texto de más abajo. */}
      <div className="cart-field">
        <span>¿Retirás o te lo enviamos?</span>
        <div className="cart-metodo">
          <button type="button" className={'cart-metodo-b' + (estadoEnvio.metodo === 'retiro' ? ' is-on' : '')} onClick={() => elegirMetodo('retiro')}>Retiro en el local</button>
          <button type="button" className={'cart-metodo-b' + (estadoEnvio.metodo === 'envio' ? ' is-on' : '')} onClick={() => elegirMetodo('envio')}>Envío a domicilio</button>
        </div>
      </div>

      {estadoEnvio.metodo === 'retiro' && (
        <div className="cart-envio-campos">
          <div className="cart-chips">
            {datosEnvios.sucursales.map((s) => (
              <button key={s.id} type="button" className={'cart-chip' + (estadoEnvio.sucursalId === s.id ? ' is-on' : '')}
                onClick={() => actualizarEnvio({ sucursalId: s.id })}>
                {s.nombre}
              </button>
            ))}
          </div>
          {estadoEnvio.sucursalId && datosEnvios.sucursales.find((s) => s.id === estadoEnvio.sucursalId)?.requiere_transferencia && (
            <p className="cart-suc-nota">
              En {datosEnvios.sucursales.find((s) => s.id === estadoEnvio.sucursalId)?.nombre} tenemos menos stock, así que tu pedido se arma en el Centro y viaja hasta ahí. Por eso el retiro ahí necesita un día más.
            </p>
          )}
        </div>
      )}

      {estadoEnvio.metodo === 'envio' && (
        <div className="cart-envio-campos">
          {entregaPropia && (
            <label className="cart-field">
              <span>Zona / barrio</span>
              <select value={estadoEnvio.zonaId || ''} onChange={(e) => { actualizarEnvio({ zonaId: e.target.value || null }); direccionRevisada.current = ''; }}>
                <option value="" disabled>Elegí una zona…</option>
                {Array.from(grupos.entries()).map(([grupo, zonas]) => (
                  <optgroup key={grupo} label={nombreCorredor(grupo)}>
                    {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
              {zona?.descripcion && <p className="cart-field-hint">{zona.descripcion}</p>}
            </label>
          )}

          <label className="cart-field">
            <span>Dirección</span>
            <input type="text" placeholder="Calle, número, referencia" value={estadoEnvio.direccion}
              onChange={(e) => actualizarEnvio({ direccion: e.target.value })} onBlur={revisarDireccion} />
          </label>
          {direccionLink && <a className="cart-direccion-maps" href={direccionLink} target="_blank" rel="noopener">Ver esta dirección en Google Maps</a>}
          {avisoDireccion && <p className={'cart-field-hint' + (avisoDireccion.lejos ? ' cart-field-hint-alerta' : '')}>{avisoDireccion.texto}</p>}

          <label className="cart-field">
            <span>Entre qué calles</span>
            <input type="text" placeholder="Entre qué calles" value={estadoEnvio.entreCalles} onChange={(e) => actualizarEnvio({ entreCalles: e.target.value })} />
          </label>
          <label className="cart-field">
            <span>Piso / depto / timbre</span>
            <input type="text" placeholder="Piso / depto / timbre" value={estadoEnvio.pisoDepto} onChange={(e) => actualizarEnvio({ pisoDepto: e.target.value })} />
          </label>

          <label className="cart-recibe-otra">
            <input type="checkbox" checked={estadoEnvio.recibeOtra} onChange={(e) => actualizarEnvio({ recibeOtra: e.target.checked })} />
            <span>¿Lo recibe otra persona?</span>
          </label>
          {estadoEnvio.recibeOtra && (
            <div className="cart-envio-campos">
              <label className="cart-field"><span>Nombre de quien recibe</span>
                <input type="text" value={estadoEnvio.receptorNombre} onChange={(e) => actualizarEnvio({ receptorNombre: e.target.value })} /></label>
              <label className="cart-field"><span>Teléfono de quien recibe</span>
                <input type="tel" value={estadoEnvio.receptorTelefono} onChange={(e) => actualizarEnvio({ receptorTelefono: e.target.value })} /></label>
            </div>
          )}

          {entregaPropia && (
            <>
              <label className="cart-recibe-otra">
                <input type="checkbox" checked={estadoEnvio.envioInmediato} onChange={(e) => activarEnvioInmediato(e.target.checked)} />
                <span>Envío inmediato — sale en el próximo turno (con recargo)</span>
              </label>
              {estadoEnvio.envioInmediato && (
                <p className="cart-field-hint">
                  {buscandoTurno
                    ? 'Buscando el próximo turno disponible…'
                    : estadoEnvio.turnoInmediato
                      ? `Sale el ${fechaLegible(estadoEnvio.turnoInmediato.fecha)}, turno ${estadoEnvio.turnoInmediato.franjaNombre}.`
                      : 'No encontramos un turno inmediato disponible por ahora — probá una fecha normal o escribinos por WhatsApp.'}
                </p>
              )}
              {costo > 0 && (
                <p className="cart-envio-costo">
                  {`Envío a ${zona?.nombre || 'tu zona'}: ${plata(costo)}${estadoEnvio.envioInmediato ? ' (incluye recargo por envío inmediato)' : ''} (el total de los productos te lo confirmamos por WhatsApp)`}
                </p>
              )}
              {datosEnvios.config.minimo_compra > 0 && (
                <p className="cart-envio-minimo">{'Compra mínima para envío: ' + plata(datosEnvios.config.minimo_compra)}</p>
              )}
            </>
          )}

          {!estadoEnvio.envioInmediato && (
            <div className="cart-envio-info">
              <p className="cart-field-hint">
                {entregaPropia
                  ? 'Te lo entregamos en 1 a 3 días hábiles. Te confirmamos por WhatsApp el día y el horario exacto (de 9 a 13 o de 17 a 21).'
                  : 'El envío lo coordinás vos: pedís un remis, Uber Moto o Uber Envíos que lo retire en el local y lo lleve a la dirección que nos dejaste. El costo del viaje lo pagás directo a quien te lo lleva.'}
              </p>
            </div>
          )}
        </div>
      )}

      {estadoEnvio.metodo === 'retiro' && (
        <div className="cart-fecha-franja">
          <label className="cart-field">
            <span>¿Para cuándo lo necesitás?</span>
            <div className="cart-dias">
              {dias.map((d) => {
                const p = d.fecha.split('-');
                return (
                  <button key={d.fecha} type="button" title={!d.disponible ? (MOTIVO_TXT[d.motivo || ''] || 'No disponible.') : undefined}
                    className={'cart-chip' + (!d.disponible ? ' is-off' : '') + (d.fecha === estadoEnvio.fecha ? ' is-on' : '')}
                    onClick={() => { if (d.disponible) actualizarEnvio({ fecha: d.fecha, franjaId: null }); }}>
                    <b>{p[2]}</b>{mesCorto(p[1])}
                  </button>
                );
              })}
            </div>
          </label>
          <label className="cart-field">
            <span>Franja horaria</span>
            <div className="cart-chips">
              {!estadoEnvio.fecha ? (
                <p className="cart-field-hint">Elegí primero una fecha.</p>
              ) : franjasDia.length === 0 ? (
                <p className="cart-field-hint">{isodowFecha === 7 ? 'Los domingos el local está cerrado.' : 'No hay franjas para ese día.'}</p>
              ) : (
                franjasDia.map((f) => (
                  <button key={f.id} type="button" className={'cart-chip' + (estadoEnvio.franjaId === f.id ? ' is-on' : '')}
                    onClick={() => actualizarEnvio({ franjaId: f.id })}>
                    {`${f.nombre} (${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)})`}
                  </button>
                ))
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
