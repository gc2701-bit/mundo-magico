'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCuenta } from '../cuenta/CuentaProvider';
import { TABLAS, ORDEN_TABS, parsearOrden } from '@/lib/admin-envios-config';
import FilaFormulario from './FilaFormulario';

/**
 * Panel con pestañas del editor de configuración de envíos — puerto de
 * cargarTab()/pintarTabs() de admin-envios.js (Sprint 5, Task 5.4).
 */
export default function AdminEnviosPanel() {
  const { sb } = useCuenta();
  const [tabActiva, setTabActiva] = useState<(typeof ORDEN_TABS)[number]>(ORDEN_TABS[0]);
  const [filas, setFilas] = useState<Record<string, unknown>[] | null>(null);
  const [tarifas, setTarifas] = useState<{ id: string; nombre: string }[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  const cargarTab = useCallback(async (clave: (typeof ORDEN_TABS)[number]) => {
    setTabActiva(clave);
    setFilas(null);
    setMensaje('Cargando…');
    setEsError(false);
    const def = TABLAS[clave];

    let tarifasActuales = tarifas;
    if (!tarifasActuales.length) {
      const r = await sb.from('envio_tarifas').select('*').order('orden', { ascending: true });
      tarifasActuales = r.data || [];
      setTarifas(tarifasActuales);
    }

    let q = sb.from(def.tabla).select('*');
    parsearOrden(def.orden).forEach(({ columna, ascendente }) => {
      q = q.order(columna, { ascending: ascendente });
    });
    const r = await q;
    if (r.error) {
      setMensaje(`No se pudo cargar ${def.titulo}: ${r.error.message}`);
      setEsError(true);
      return;
    }
    setMensaje('');
    setFilas(r.data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  useEffect(() => { cargarTab(tabActiva); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const def = TABLAS[tabActiva];

  return (
    <>
      <div className="adm-cfg-tabs">
        {ORDEN_TABS.map((clave) => (
          <button key={clave} type="button" className={'adm-cfg-tab' + (clave === tabActiva ? ' is-on' : '')} onClick={() => cargarTab(clave)}>
            {TABLAS[clave].titulo}
          </button>
        ))}
      </div>

      {mensaje && <p className={'adm-resumen' + (esError ? ' adm-msg-error' : '')}>{mensaje}</p>}

      <div className="adm-cfg-contenido">
        {filas !== null && (
          <div className="adm-cfg-tabla">
            {def.permiteNuevo && (
              <FilaFormulario key={tabActiva + '-nueva'} sb={sb} def={def} fila={null} tarifas={tarifas} onGuardado={() => cargarTab(tabActiva)} />
            )}
            {filas.map((fila) => (
              <FilaFormulario key={String(fila[def.clave || 'id'])} sb={sb} def={def} fila={fila} tarifas={tarifas} onGuardado={() => cargarTab(tabActiva)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
