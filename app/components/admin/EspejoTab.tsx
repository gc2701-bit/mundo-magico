'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { procesarFoto, subirFoto } from '@/lib/procesar-foto';
import { slugifyMundo } from '@/lib/catalogo-mundo';
import { slugify } from '@/lib/slug';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

// Mismos anchos en % que PublicadoTab.tsx (nunca puede superar el 100%
// del contenedor en table-fixed) — acá con las columnas propias de esta
// pestaña (sin Mundo/Estado: todavía no están categorizados ni
// publicados) más la de acción, que ahí es "Editar" y acá "Activar".
const COLUMNAS: { label: string; alinear?: 'right'; widthPct: number }[] = [
  { label: 'Código', widthPct: 12 },
  { label: 'Nombre', widthPct: 28 },
  { label: 'Familia', widthPct: 16 },
  { label: 'Precio', alinear: 'right', widthPct: 12 },
  { label: 'Stock', alinear: 'right', widthPct: 10 },
  { label: 'Tipo', widthPct: 12 }
];

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
 * todavía no tienen producto propio en el catálogo. La familia la manda
 * Búho directo (fila.familia, dato interno desde Sprint 5.5) — pero el
 * mundo (categorización pública) nadie lo manda automático, así que
 * activar SÍ pide elegirlo (ver plan, Sprint 5.5, Task 5.5.6). Filtro por
 * Familia en esta lista queda fuera de esta tanda (ver
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

  const mensajeVacio = busqueda ? 'No hay artículos sin activar que coincidan con la búsqueda.' : 'No hay artículos para activar todavía.';

  return (
    <div className="space-y-3">
      <div className="adm-lista-toolbar flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por nombre, código o familia"
          aria-label="Buscar en el espejo de Búho"
          className="sm:w-64"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            cargar(e.target.value);
          }}
        />
      </div>

      {/* Mismo patrón responsive que PublicadoTab.tsx: tabla real en
       * desktop (≥1024px), lista de tarjetas en mobile — para que "Sin
       * activar" se vea como una copia visual de "Publicado", con la
       * única diferencia real (que no está publicado). */}
      <div className="hidden lg:block">
        <Table className="adm-lista-tabla table-fixed">
          <TableHeader>
            <TableRow>
              {COLUMNAS.map(({ label, alinear, widthPct }) => (
                <TableHead key={label} style={{ width: `${widthPct}%` }} className={'whitespace-nowrap' + (alinear === 'right' ? ' text-right' : '')}>
                  {label}
                </TableHead>
              ))}
              <TableHead style={{ width: '10%' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS.length + 1} className="adm-detalle-solo-lectura text-center">
                  {mensajeVacio}
                </TableCell>
              </TableRow>
            ) : (
              lista.map((f) => (
                <TableRow key={f.codigo}>
                  <TableCell className="whitespace-normal break-words font-mono text-sm text-muted-foreground">{f.codigo}</TableCell>
                  <TableCell className="whitespace-normal break-words font-medium">{f.nombre}</TableCell>
                  <TableCell className="truncate" title={f.familia || undefined}>{f.familia || '—'}</TableCell>
                  <TableCell className="text-right">{fmt.format(f.precio)}</TableCell>
                  <TableCell className="text-right">{f.stock == null ? '—' : f.stock}</TableCell>
                  <TableCell className="truncate">{f.es_combo ? 'Combo' : 'Artículo'}</TableCell>
                  <TableCell>
                    <button type="button" className="btn btn-primary" onClick={() => setActivando(f)}>
                      Activar
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ul role="list" className="grid gap-3 lg:hidden">
        {lista.length === 0 ? (
          <li className="adm-detalle-solo-lectura list-none text-center">{mensajeVacio}</li>
        ) : (
          lista.map((f) => (
            <li key={f.codigo} className="list-none rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium break-words">{f.nombre}</p>
                  <p className="break-words font-mono text-xs text-muted-foreground">{f.codigo}</p>
                </div>
                <button type="button" className="btn btn-primary shrink-0" onClick={() => setActivando(f)}>
                  Activar
                </button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted-foreground">Familia</dt>
                  <dd>{f.familia || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd>{f.es_combo ? 'Combo' : 'Artículo'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stock</dt>
                  <dd>{f.stock == null ? '—' : f.stock}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Precio</dt>
                  <dd>{fmt.format(f.precio)}</dd>
                </div>
              </dl>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ActivacionEspejo({ fila, onVolver, onActivado }: { fila: FilaEspejo; onVolver: () => void; onActivado: () => void }) {
  const [fotos, setFotos] = useState<{ src: string; cap: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState('');
  const [mundos, setMundos] = useState<{ slug: string; nombre: string }[]>([]);
  const [mundo, setMundo] = useState('');
  const [mundoNuevo, setMundoNuevo] = useState('');

  useEffect(() => {
    supabaseBrowser()
      .from('catalogo_mundos')
      .select('slug, nombre')
      .order('orden')
      .then(({ data }) => setMundos(data || []));
  }, []);

  async function agregarFoto(file: File) {
    setSubiendo(true);
    setError('');
    try {
      const blob = await procesarFoto(file);
      const carpeta = fila.familia ? slugify(fila.familia) : 'productos';
      const url = await subirFoto(supabaseBrowser(), blob, carpeta, slugify(fila.codigo), fotos.length + 1);
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
    const mundoNuevoTrim = mundoNuevo.trim();
    const mundoFinal = mundoNuevoTrim ? slugifyMundo(mundoNuevoTrim) : mundo;
    if (!mundoFinal) {
      setError('Elegí a qué mundo pertenece antes de activar.');
      return;
    }
    setActivando(true);
    setError('');
    try {
      const sb = supabaseBrowser();
      const slugTitulo = slugify(fila.nombre);

      if (mundoNuevoTrim) {
        const { error: errMundo } = await sb
          .from('catalogo_mundos')
          .insert({ slug: mundoFinal, nombre: mundoNuevoTrim, orden: mundos.length + 1 });
        if (errMundo) throw errMundo;
      }

      // Chequear si este código ya tiene un producto creado antes de insertar
      // uno nuevo: un intento de activación anterior puede haber quedado a
      // mitad de camino (ver el fix de arriba, el mismo incidente dejó
      // productos ya insertados en catalogo_productos con
      // catalogo_buho_espejo.publicado todavía en false). Reintentar sin este
      // chequeo revienta con `catalogo_productos_slug_por_pagina` (unique en
      // mundo+slug) si el nombre no cambió — un error confuso para algo que en
      // realidad ya está armado, sólo falta sincronizar precio y la marca acá
      // abajo.
      const { data: yaCreados, error: errBuscarProducto } = await sb
        .from('catalogo_productos')
        .select('id')
        .eq('codigo', fila.codigo);
      if (errBuscarProducto) throw errBuscarProducto;

      if (!yaCreados || yaCreados.length === 0) {
        const { error: err1 } = await sb.from('catalogo_productos').insert({
          titulo: fila.nombre,
          slug: slugTitulo,
          codigo: fila.codigo,
          familia: fila.familia,
          mundo: mundoFinal,
          fotos,
          publicado: true
        });
        if (err1) throw err1;
      }

      // No usar upsert(): el worker de Búho ya sincroniza precio/stock
      // directo en catalogo_precios para códigos todavía sin publicar (ver
      // catalogo_buho_espejo), así que casi siempre esta fila YA EXISTE acá.
      // El upsert de supabase-js genera `on conflict (codigo) do update set
      // codigo = excluded.codigo, ...` — pisa `codigo` aunque no cambie, y
      // esa columna no tiene GRANT de UPDATE a propósito (catalogo_00_base.sql,
      // para que nadie reasigne en silencio el precio de un producto a otro).
      // Insert-o-update evita tocar `codigo` en la rama de actualización.
      const sinStock = fila.stock != null && fila.stock <= 0;
      const { error: errPrecioInsert } = await sb.from('catalogo_precios').insert({
        codigo: fila.codigo,
        precio: fila.precio,
        stock: fila.stock,
        sin_stock: sinStock
      });
      if (errPrecioInsert) {
        if (errPrecioInsert.code !== '23505') throw errPrecioInsert;
        const { error: errPrecioUpdate } = await sb
          .from('catalogo_precios')
          .update({ precio: fila.precio, stock: fila.stock, sin_stock: sinStock })
          .eq('codigo', fila.codigo);
        if (errPrecioUpdate) throw errPrecioUpdate;
      }

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
      <div className="adm-detalle-campo">
        <label>
          Mundo (obligatorio para activar)
          <select value={mundo} onChange={(e) => { setMundo(e.target.value); setMundoNuevo(''); }}>
            <option value="">— elegir mundo —</option>
            {mundos.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          o escribir uno nuevo
          <input type="text" value={mundoNuevo} onChange={(e) => setMundoNuevo(e.target.value)} placeholder="Nombre de mundo nuevo" />
        </label>
      </div>

      {error && <p className="adm-msg adm-msg-error">{error}</p>}

      <button type="button" className="btn btn-primary" disabled={activando} onClick={activar}>
        Activar
      </button>
    </div>
  );
}
