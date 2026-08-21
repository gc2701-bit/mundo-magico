'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { valorInicial, leerValor, type ColumnaDef, type TablaDef } from '@/lib/admin-envios-config';

type Tarifa = { id: string; nombre: string };

type Props = {
  sb: SupabaseClient;
  def: TablaDef;
  fila: Record<string, unknown> | null; // null = fila nueva
  tarifas: Tarifa[];
  onGuardado: () => void;
};

/**
 * Una fila editable de cualquier tabla de configuración — puerto de
 * filaFormulario()/campoInput()/leerInput() de admin-envios.js (Sprint 5,
 * Task 5.4). Genérica: el mismo componente arma zonas, tarifas, franjas,
 * etc. a partir de `def.columnas` (ver lib/admin-envios-config.ts).
 */
export default function FilaFormulario({ sb, def, fila, tarifas, onGuardado }: Props) {
  const esNueva = !fila;
  const clave = def.clave || 'id';

  const [valores, setValores] = useState<Record<string, string | boolean>>(() => {
    const inicial: Record<string, string | boolean> = {};
    def.columnas.forEach((col) => {
      inicial[col.campo] = fila ? valorInicial(col, fila[col.campo]) : (col.tipo === 'bool' ? false : '');
    });
    return inicial;
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function set(campo: string, v: string | boolean) {
    setValores((actual) => ({ ...actual, [campo]: v }));
  }

  async function guardar() {
    const datos: Record<string, unknown> = {};
    def.columnas.forEach((col) => {
      const v = leerValor(col, valores[col.campo]);
      if (v !== undefined) datos[col.campo] = v;
    });
    setGuardando(true);
    setError('');
    const { error: err } = esNueva
      ? await sb.from(def.tabla).insert(datos)
      : await sb.from(def.tabla).update(datos).eq(clave, fila![clave]);
    setGuardando(false);
    if (err) { setError('No se pudo guardar: ' + err.message); return; }
    onGuardado();
  }

  async function borrar() {
    if (!window.confirm('¿Quitar esta fila? No se puede deshacer.')) return;
    setGuardando(true);
    setError('');
    const { error: err } = await sb.from(def.tabla).delete().eq(clave, fila![clave]);
    setGuardando(false);
    if (err) { setError('No se pudo quitar: ' + err.message); return; }
    onGuardado();
  }

  return (
    <div className={'adm-cfg-fila' + (esNueva ? ' adm-cfg-fila-nueva' : '')}>
      {def.columnas.map((col) => (
        <label className="adm-cfg-campo" key={col.campo}>
          <span>{col.label}</span>
          <CampoInput col={col} valor={valores[col.campo]} tarifas={tarifas} onChange={(v) => set(col.campo, v)} valorCrudo={fila ? fila[col.campo] : null} />
        </label>
      ))}
      <div className="adm-cfg-acciones">
        <button type="button" className="adm-cfg-guardar" disabled={guardando} onClick={guardar}>
          {esNueva ? 'Agregar' : 'Guardar'}
        </button>
        {def.permiteBorrar && !esNueva && (
          <button type="button" className="adm-cfg-borrar" disabled={guardando} onClick={borrar}>Quitar</button>
        )}
      </div>
      {error && <p className="adm-cfg-error">{error}</p>}
    </div>
  );
}

function CampoInput({ col, valor, tarifas, onChange, valorCrudo }: {
  col: ColumnaDef;
  valor: string | boolean;
  tarifas: Tarifa[];
  onChange: (v: string | boolean) => void;
  valorCrudo: unknown;
}) {
  if (col.soloLectura) return <span className="adm-cfg-ro">{valorCrudo == null ? '' : String(valorCrudo)}</span>;

  if (col.tipo === 'bool') {
    return <input type="checkbox" checked={!!valor} onChange={(e) => onChange(e.target.checked)} />;
  }

  if (col.tipo === 'select' || col.tipo === 'select_tarifa') {
    const opciones = col.tipo === 'select_tarifa'
      ? tarifas.map((t) => ({ value: t.id, label: t.nombre }))
      : (col.opciones || []).map((o) => ({ value: o, label: o || '(todos)' }));
    return (
      <select value={String(valor)} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (col.tipo === 'parrafo') {
    return <textarea rows={3} value={String(valor)} onChange={(e) => onChange(e.target.value)} />;
  }

  const type = col.tipo === 'numero' ? 'number' : col.tipo === 'hora' ? 'time' : col.tipo === 'fecha' ? 'date' : 'text';
  return <input type={type} value={String(valor)} onChange={(e) => onChange(e.target.value)} />;
}
