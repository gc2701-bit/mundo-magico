'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { procesarFoto, subirFoto } from '@/lib/procesar-foto';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type FilaEspejo = {
  codigo: string;
  nombre: string;
  familia: string | null;
  precio: number;
  stock: number | null;
  es_combo: boolean;
};

/**
 * Pestaña "Sin activar" — códigos que ya llegaron del worker de Búho pero
 * todavía no tienen producto propio en el catálogo. Con familias
 * reemplazando mundos, activar ya no pide elegir dónde va: la familia la
 * manda Búho directo (fila.familia) — sólo falta la foto, que Búho no
 * trae. Filtro por Familia en esta lista queda fuera de esta tanda (ver
 * docs/superpowers/plans/2026-08-20-catalogo-admin-huerfanos.md, Task 3).
 */
export default function EspejoTab() {
  const [lista, setLista] = useState<FilaEspejo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [activando, setActivando] = useState<FilaEspejo | null>(null);

  async function cargar(q?: string) {
    const sb = supabaseBrowser();
    let query = sb.from('catalogo_buho_espejo').select('codigo, nombre, familia, precio, stock, es_combo').eq('publicado', false).order('nombre');
    if (q) query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,familia.ilike.%${q}%`);
    const { data, error } = await query;
    if (!error && data) setLista(data as FilaEspejo[]);
    setCargado(true);
  }

  if (!cargado) {
    cargar();
    return <p className="adm-detalle-solo-lectura">Cargando el espejo de Búho…</p>;
  }

  if (activando) {
    return (
      <ActivacionEspejo
        fila={activando}
        onVolver={() => setActivando(null)}
        onActivado={() => {
          setActivando(null);
          cargar(busqueda);
        }}
      />
    );
  }

  return (
    <div>
      <div className="adm-lista-toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, código o familia"
          aria-label="Buscar en el espejo de Búho"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            cargar(e.target.value);
          }}
        />
      </div>
      <table className="adm-lista-tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Familia</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Tipo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 ? (
            <tr>
              <td colSpan={7} className="adm-detalle-solo-lectura">
                {busqueda ? 'No hay artículos sin activar que coincidan con la búsqueda.' : 'No hay artículos para activar todavía.'}
              </td>
            </tr>
          ) : (
            lista.map((f) => (
              <tr key={f.codigo}>
                <td>{f.codigo}</td>
                <td>{f.nombre}</td>
                <td>{f.familia || '—'}</td>
                <td>{fmt.format(f.precio)}</td>
                <td>{f.stock == null ? '—' : f.stock}</td>
                <td>{f.es_combo ? 'Combo' : 'Artículo'}</td>
                <td>
                  <button type="button" className="btn btn-primary" onClick={() => setActivando(f)}>
                    Activar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActivacionEspejo({ fila, onVolver, onActivado }: { fila: FilaEspejo; onVolver: () => void; onActivado: () => void }) {
  const [fotos, setFotos] = useState<{ src: string; cap: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState('');

  async function agregarFoto(file: File) {
    setSubiendo(true);
    setError('');
    try {
      const blob = await procesarFoto(file);
      const carpeta = fila.familia ? fila.familia.toLowerCase().replace(/\s+/g, '-') : 'productos';
      const url = await subirFoto(supabaseBrowser(), blob, carpeta, fila.codigo, fotos.length + 1);
      setFotos((prev) => [...prev, { src: url, cap: '' }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function activar() {
    if (!fotos.length) {
      setError('Subí al menos una foto antes de activar.');
      return;
    }
    setActivando(true);
    setError('');
    try {
      const sb = supabaseBrowser();
      const slugTitulo = fila.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { error: err1 } = await sb.from('catalogo_productos').insert({
        titulo: fila.nombre,
        slug: slugTitulo,
        codigo: fila.codigo,
        familia: fila.familia,
        fotos,
        publicado: true
      });
      if (err1) throw err1;

      const { error: err2 } = await sb.from('catalogo_precios').upsert({
        codigo: fila.codigo,
        precio: fila.precio,
        stock: fila.stock,
        sin_stock: fila.stock != null && fila.stock <= 0
      });
      if (err2) throw err2;

      const { error: err3 } = await sb.from('catalogo_buho_espejo').update({ publicado: true }).eq('codigo', fila.codigo);
      if (err3) throw err3;

      onActivado();
    } catch (err) {
      setError((err as Error).message);
      setActivando(false);
    }
  }

  return (
    <div className="adm-detalle">
      <button type="button" className="btn btn-ghost adm-detalle-volver" onClick={onVolver}>
        Volver a la lista
      </button>
      <h2>{fila.nombre}</h2>
      <p className="adm-detalle-solo-lectura">
        Código {fila.codigo} · Familia {fila.familia || '—'} · {fmt.format(fila.precio)}
        {fila.stock != null ? ` · Stock ${fila.stock}` : ''} — lo manda Búho, no se edita acá.
      </p>

      <div className="adm-detalle-fotos">
        {fotos.map((f, i) => (
          <figure key={i}>
            <img src={f.src} alt={fila.nombre} />
            <button type="button" className="adm-detalle-quitar-foto" onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}>
              Quitar
            </button>
          </figure>
        ))}
      </div>
      <div className="adm-detalle-campo">
        <label>
          Foto (obligatoria para activar, se ajusta sola a 1080×1080 con fondo blanco)
          <input
            type="file"
            accept="image/*"
            disabled={subiendo}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) agregarFoto(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error && <p className="adm-msg adm-msg-error">{error}</p>}

      <button type="button" className="btn btn-primary" disabled={activando} onClick={activar}>
        Activar
      </button>
    </div>
  );
}
