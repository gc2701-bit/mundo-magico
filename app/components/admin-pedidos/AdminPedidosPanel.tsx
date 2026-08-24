'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCuenta } from '../cuenta/CuentaProvider';
import { cargarEnvios, ESTADOS, telWa, type DatosEnvios } from '@/lib/envios';
import {
  agruparPedidos, filtrarPedidos, statsPorEstado, resolverMensaje,
  type Pedido, type ModoAgrupar,
} from '@/lib/pedidos-admin';
import PedidoCard from './PedidoCard';

const PAGINA = 200;

function fechaISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

/**
 * Panel de pedidos — puerto de cargarPedidos()/pintarLista()/pintarStats()
 * de admin-pedidos.js (Sprint 5, Task 5.3). Ventana por defecto: una semana
 * atrás, un mes adelante (mismo criterio que el original).
 */
export default function AdminPedidosPanel() {
  const { sb } = useCuenta();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [hayMas, setHayMas] = useState(false);
  const paginaRef = useRef(0);

  const [desde, setDesde] = useState(fechaISO(-7));
  const [hasta, setHasta] = useState(fechaISO(37));
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modoAgrupar, setModoAgrupar] = useState<ModoAgrupar>('fecha');
  const [verArchivados, setVerArchivados] = useState(false);

  const [datosEnvios, setDatosEnvios] = useState<DatosEnvios | null>(null);
  const plantillasRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelado = false;
    cargarEnvios(sb).then((d) => { if (!cancelado) setDatosEnvios(d); });
    return () => { cancelado = true; };
  }, [sb]);

  const consultaBase = useCallback(() => {
    let q = sb.from('pedidos').select('*');
    if (!verArchivados) q = q.eq('archivado', false);
    if (desde && hasta) {
      q = q.or(`fecha_entrega.is.null,and(fecha_entrega.gte.${desde},fecha_entrega.lte.${hasta})`);
    }
    return q.order('fecha_entrega', { ascending: true, nullsFirst: false });
  }, [sb, verArchivados, desde, hasta]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    paginaRef.current = 0;
    const r = await consultaBase().range(0, PAGINA - 1);
    setCargando(false);
    if (r.error) {
      setError('No se pudieron cargar los pedidos. ¿Ya corriste supabase/pedidos_envio.sql y te diste de alta en la tabla admins?');
      return;
    }
    const data = (r.data || []) as Pedido[];
    setPedidos(data);
    setHayMas(data.length === PAGINA);
  }, [consultaBase]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cargarMas() {
    paginaRef.current += 1;
    const desdeIdx = paginaRef.current * PAGINA;
    const r = await consultaBase().range(desdeIdx, desdeIdx + PAGINA - 1);
    if (r.error) { paginaRef.current -= 1; return; }
    const nuevos = (r.data || []) as Pedido[];
    setPedidos((actuales) => actuales.concat(nuevos));
    setHayMas(nuevos.length === PAGINA);
  }

  function onActualizarPedido(actualizado: Pedido) {
    setPedidos((actuales) => actuales.map((p) => (p.id === actualizado.id ? actualizado : p)));
  }

  async function onAvisar(p: Pedido) {
    if (!plantillasRef.current) {
      const { data } = await sb.from('mensajes_plantillas').select('*').eq('activa', true);
      const mapa: Record<string, string> = {};
      (data || []).forEach((row: { estado: string; cuerpo: string }) => { mapa[row.estado] = row.cuerpo; });
      plantillasRef.current = mapa;
    }
    if (p.estado === 'confirmado' && p.metodo_entrega === 'envio' && !p.fecha_entrega) {
      if (!window.confirm('Todavía no le asignaste fecha/franja a este envío — el mensaje va a salir sin esos datos. ¿Mandarlo igual?')) return;
    }
    const cuerpo = plantillasRef.current[p.estado];
    if (!cuerpo) { window.alert(`No hay una plantilla activa para el estado "${p.estado}".`); return; }
    const msg = resolverMensaje(p, cuerpo, datosEnvios, datosEnvios?.sucursales || []);
    window.open(`https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }

  const stats = statsPorEstado(pedidos, ESTADOS);
  const listaFiltrada = filtrarPedidos(pedidos, filtroEstado);
  const grupos = agruparPedidos(listaFiltrada, modoAgrupar);

  return (
    <>
      <p className="adm-stats-hint">De la ventana de fechas elegida abajo, cuántos pedidos llegaron sin confirmar todavía si se concretó la venta:</p>
      <div className="adm-stats">
        {stats.map((s) => (
          <button
            key={s.valor}
            type="button"
            className={'adm-stat' + (s.valor && s.valor !== '__atrasados' ? ' ep-' + s.valor : '') + (s.valor === '__atrasados' ? ' is-atrasado' : '') + (filtroEstado === s.valor ? ' is-on' : '')}
            onClick={() => setFiltroEstado(s.valor)}
          >
            <b>{s.cantidad}</b><span>{s.etiqueta}</span>
          </button>
        ))}
      </div>

      <div className="adm-controls">
        <label className="adm-group">
          <span>Agrupar por</span>
          <select value={modoAgrupar} onChange={(e) => setModoAgrupar(e.target.value as ModoAgrupar)}>
            <option value="fecha">Fecha de entrega</option>
            <option value="metodo">Retiro / Envío</option>
            <option value="zona">Zona</option>
            <option value="estado">Estado</option>
          </select>
        </label>
        <label className="adm-group">
          <span>Filtrar por estado</span>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            <option value="__atrasados">Atrasados</option>
          </select>
        </label>
        <label className="adm-group">
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="adm-group">
          <span>Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="adm-group adm-group-check">
          <span>&nbsp;</span>
          <span className="adm-check-inline">
            <input type="checkbox" checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} /> Ver archivados
          </span>
        </label>
        <button type="button" className="adm-refrescar" onClick={cargar}>Actualizar</button>
      </div>

      <p className="adm-resumen">
        {cargando ? 'Cargando…' : error ? error : `${listaFiltrada.length} pedido(s)${filtroEstado ? ` · filtrado por "${filtroEstado}"` : ''}`}
      </p>

      <div className="adm-grupos">
        {grupos.map((g) => (
          <section className="adm-grupo" key={g.clave}>
            <h2 className="adm-grupo-t"><span>{g.clave}</span><span className="adm-grupo-n">{g.pedidos.length}</span></h2>
            {g.pedidos.map((p) => (
              <PedidoCard key={p.id} sb={sb} pedido={p} datosEnvios={datosEnvios} onActualizar={onActualizarPedido} onAvisar={onAvisar} />
            ))}
          </section>
        ))}
      </div>

      <div className="adm-cargar-mas-wrap">
        {hayMas && <button type="button" className="adm-cargar-mas" onClick={cargarMas}>Cargar más pedidos</button>}
      </div>
    </>
  );
}
