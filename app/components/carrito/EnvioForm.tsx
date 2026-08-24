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
 *
 * Rediseño Sprint 8 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * Tailwind en vez de `carrito.css` — lo comparten el mini-carrito
 * (CarritoPanel.tsx) y la página `/carrito` nueva, un solo rediseño para
 * las dos. Sólo cambia presentación, ningún estado/handler se tocó.
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

  const campo = 'rounded-brand border border-line px-s3 py-s2 font-body text-fs0 text-ink';
  const hint = 'font-body text-fs-1 text-muted';
  const chip = 'rounded-full border border-line px-s3 py-1.5 font-body text-fs-1 text-ink';
  const chipOn = 'border-green bg-green text-white!';
  const chipOff = 'disabled:opacity-40';

  return (
    <div className="flex flex-col gap-s3">
      <h3 className="font-body text-fs0 font-semibold text-ink">Tus datos</h3>

      <label className="flex flex-col gap-1">
        <span className="font-body text-fs-1 text-muted">Nombre</span>
        <input type="text" placeholder="Tu nombre" value={estadoEnvio.nombre} onChange={(e) => actualizarEnvio({ nombre: e.target.value })} className={campo} />
      </label>

      {/* Un <label> envolviendo dos botones les concatena el texto del label
          a los DOS como accessible name (ambigüedad de a11y/testing) — por
          eso acá es un <div>, no <label>, a diferencia de los campos de
          texto de más arriba. */}
      <div className="flex flex-col gap-1">
        <span className="font-body text-fs-1 text-muted">¿Retirás o te lo enviamos?</span>
        <div className="flex gap-s2">
          <button type="button" onClick={() => elegirMetodo('retiro')}
            className={'flex-1 rounded-brand border px-s3 py-s2 font-body text-fs0 font-semibold ' + (estadoEnvio.metodo === 'retiro' ? 'border-green bg-green text-white!' : 'border-line text-ink')}>
            Retiro en el local
          </button>
          <button type="button" onClick={() => elegirMetodo('envio')}
            className={'flex-1 rounded-brand border px-s3 py-s2 font-body text-fs0 font-semibold ' + (estadoEnvio.metodo === 'envio' ? 'border-green bg-green text-white!' : 'border-line text-ink')}>
            Envío a domicilio
          </button>
        </div>
      </div>

      {estadoEnvio.metodo === 'retiro' && (
        <div className="flex flex-col gap-s2">
          <div className="flex flex-wrap gap-s2">
            {datosEnvios.sucursales.map((s) => (
              <button key={s.id} type="button" onClick={() => actualizarEnvio({ sucursalId: s.id })}
                className={chip + ' ' + (estadoEnvio.sucursalId === s.id ? chipOn : '')}>
                {s.nombre}
              </button>
            ))}
          </div>
          {estadoEnvio.sucursalId && datosEnvios.sucursales.find((s) => s.id === estadoEnvio.sucursalId)?.requiere_transferencia && (
            <p className={hint}>
              En {datosEnvios.sucursales.find((s) => s.id === estadoEnvio.sucursalId)?.nombre} tenemos menos stock, así que tu pedido se arma en el Centro y viaja hasta ahí. Por eso el retiro ahí necesita un día más.
            </p>
          )}
        </div>
      )}

      {estadoEnvio.metodo === 'envio' && (
        <div className="flex flex-col gap-s3">
          {entregaPropia && (
            <label className="flex flex-col gap-1">
              <span className="font-body text-fs-1 text-muted">Zona / barrio</span>
              <select value={estadoEnvio.zonaId || ''} onChange={(e) => { actualizarEnvio({ zonaId: e.target.value || null }); direccionRevisada.current = ''; }} className={campo}>
                <option value="" disabled>Elegí una zona…</option>
                {Array.from(grupos.entries()).map(([grupo, zonas]) => (
                  <optgroup key={grupo} label={nombreCorredor(grupo)}>
                    {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
              {zona?.descripcion && <p className={hint}>{zona.descripcion}</p>}
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">Dirección</span>
            <input type="text" placeholder="Calle, número, referencia" value={estadoEnvio.direccion}
              onChange={(e) => actualizarEnvio({ direccion: e.target.value })} onBlur={revisarDireccion} className={campo} />
          </label>
          {direccionLink && <a className="font-body text-fs-1 font-semibold text-green-ink! underline" href={direccionLink} target="_blank" rel="noopener">Ver esta dirección en Google Maps</a>}
          {avisoDireccion && <p className={'font-body text-fs-1 ' + (avisoDireccion.lejos ? 'text-orange-ink' : 'text-muted')}>{avisoDireccion.texto}</p>}

          <label className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">Entre qué calles</span>
            <input type="text" placeholder="Entre qué calles" value={estadoEnvio.entreCalles} onChange={(e) => actualizarEnvio({ entreCalles: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">Piso / depto / timbre</span>
            <input type="text" placeholder="Piso / depto / timbre" value={estadoEnvio.pisoDepto} onChange={(e) => actualizarEnvio({ pisoDepto: e.target.value })} className={campo} />
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={estadoEnvio.recibeOtra} onChange={(e) => actualizarEnvio({ recibeOtra: e.target.checked })} />
            <span className="font-body text-fs0 text-ink">¿Lo recibe otra persona?</span>
          </label>
          {estadoEnvio.recibeOtra && (
            <div className="flex flex-col gap-s3">
              <label className="flex flex-col gap-1"><span className="font-body text-fs-1 text-muted">Nombre de quien recibe</span>
                <input type="text" value={estadoEnvio.receptorNombre} onChange={(e) => actualizarEnvio({ receptorNombre: e.target.value })} className={campo} /></label>
              <label className="flex flex-col gap-1"><span className="font-body text-fs-1 text-muted">Teléfono de quien recibe</span>
                <input type="tel" value={estadoEnvio.receptorTelefono} onChange={(e) => actualizarEnvio({ receptorTelefono: e.target.value })} className={campo} /></label>
            </div>
          )}

          {entregaPropia && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={estadoEnvio.envioInmediato} onChange={(e) => activarEnvioInmediato(e.target.checked)} />
                <span className="font-body text-fs0 text-ink">Envío inmediato — sale en el próximo turno (con recargo)</span>
              </label>
              {estadoEnvio.envioInmediato && (
                <p className={hint}>
                  {buscandoTurno
                    ? 'Buscando el próximo turno disponible…'
                    : estadoEnvio.turnoInmediato
                      ? `Sale el ${fechaLegible(estadoEnvio.turnoInmediato.fecha)}, turno ${estadoEnvio.turnoInmediato.franjaNombre}.`
                      : 'No encontramos un turno inmediato disponible por ahora — probá una fecha normal o escribinos por WhatsApp.'}
                </p>
              )}
              {costo > 0 && (
                <p className="font-body text-fs-1 font-semibold text-ink">
                  {`Envío a ${zona?.nombre || 'tu zona'}: ${plata(costo)}${estadoEnvio.envioInmediato ? ' (incluye recargo por envío inmediato)' : ''} (el total de los productos te lo confirmamos por WhatsApp)`}
                </p>
              )}
              {datosEnvios.config.minimo_compra > 0 && (
                <p className={hint}>{'Compra mínima para envío: ' + plata(datosEnvios.config.minimo_compra)}</p>
              )}
            </>
          )}

          {!estadoEnvio.envioInmediato && (
            <p className={hint}>
              {entregaPropia
                ? 'Te lo entregamos en 1 a 3 días hábiles. Te confirmamos por WhatsApp el día y el horario exacto (de 9 a 13 o de 17 a 21).'
                : 'El envío lo coordinás vos: pedís un remis, Uber Moto o Uber Envíos que lo retire en el local y lo lleve a la dirección que nos dejaste. El costo del viaje lo pagás directo a quien te lo lleva.'}
            </p>
          )}
        </div>
      )}

      {estadoEnvio.metodo === 'retiro' && (
        <div className="flex flex-col gap-s3">
          <div className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">¿Para cuándo lo necesitás?</span>
            <div className="flex flex-wrap gap-s2">
              {dias.map((d) => {
                const p = d.fecha.split('-');
                return (
                  <button key={d.fecha} type="button" disabled={!d.disponible} title={!d.disponible ? (MOTIVO_TXT[d.motivo || ''] || 'No disponible.') : undefined}
                    onClick={() => { if (d.disponible) actualizarEnvio({ fecha: d.fecha, franjaId: null }); }}
                    className={chip + ' flex flex-col items-center leading-tight ' + (d.fecha === estadoEnvio.fecha ? chipOn : chipOff)}>
                    <b>{p[2]}</b>{mesCorto(p[1])}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-body text-fs-1 text-muted">Franja horaria</span>
            <div className="flex flex-wrap gap-s2">
              {!estadoEnvio.fecha ? (
                <p className={hint}>Elegí primero una fecha.</p>
              ) : franjasDia.length === 0 ? (
                <p className={hint}>{isodowFecha === 7 ? 'Los domingos el local está cerrado.' : 'No hay franjas para ese día.'}</p>
              ) : (
                franjasDia.map((f) => (
                  <button key={f.id} type="button" onClick={() => actualizarEnvio({ franjaId: f.id })}
                    className={chip + ' ' + (estadoEnvio.franjaId === f.id ? chipOn : '')}>
                    {`${f.nombre} (${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)})`}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
