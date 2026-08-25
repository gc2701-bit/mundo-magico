'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import {
  codigosDe,
  codigosBorrablesLote,
  familiasVistas,
  contarSinFamilia,
  rutasDeStorage,
  precioStockDe,
  ordenarCatalogo,
  filtrarCatalogo,
  estadoSeleccionEncabezado,
  redondearPrecio,
  SIN_FAMILIA,
  type MapaPreciosAdmin,
  type FilaCatalogoAdmin,
  type ColumnaOrdenCatalogo
} from '@/lib/admin-catalogo';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowUpDown, Percent, Trash2, EyeOff, Loader2 } from 'lucide-react';
import ProductoEditModal, { type ProductoAdmin } from './ProductoEditModal';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const COLUMNAS: { col: ColumnaOrdenCatalogo; label: string; alinear?: 'right' }[] = [
  { col: 'codigo', label: 'Código' },
  { col: 'titulo', label: 'Nombre' },
  { col: 'familia', label: 'Familia' },
  { col: 'mundo', label: 'Mundo' },
  { col: 'stock', label: 'Stock', alinear: 'right' },
  { col: 'precio', label: 'Precio', alinear: 'right' },
  { col: 'estado', label: 'Estado' }
];

export default function PublicadoTab() {
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [mapaPrecios, setMapaPrecios] = useState<MapaPreciosAdmin>({});
  const [mundos, setMundos] = useState<{ slug: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState('');
  const [mundoFiltro, setMundoFiltro] = useState('');
  const [columna, setColumna] = useState<ColumnaOrdenCatalogo>('titulo');
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc');
  const [seleccionado, setSeleccionado] = useState<ProductoAdmin | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [pasoPrecio, setPasoPrecio] = useState(false);
  const [porcentaje, setPorcentaje] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [loteCargando, setLoteCargando] = useState(false);
  const [loteError, setLoteError] = useState('');

  useEffect(() => {
    cargar();
    supabaseBrowser()
      .from('catalogo_mundos')
      .select('slug, nombre')
      .order('orden')
      .then(({ data }) => setMundos(data || []));
  }, []);

  async function cargar() {
    setCargando(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('catalogo_productos')
      .select('id, titulo, slug, codigo, specs, descripcion, tags, variantes, fotos, familia, publicado, mundo, subcategoriaId:subcategoria_id, orden, destacadoHome:destacado_home')
      .order('titulo');
    if (!error && data) {
      const lista = data as ProductoAdmin[];
      setProductos(lista);
      const codigos = Array.from(new Set(lista.flatMap((p) => codigosDe(p))));
      if (codigos.length) {
        const { data: precios } = await sb.rpc('catalogo_precios_admin', { p_codigos: codigos });
        const mapa: MapaPreciosAdmin = {};
        (precios || []).forEach((r: { codigo: string; precio: number; stock: number | null }) => {
          mapa[r.codigo] = { precio: r.precio, stock: r.stock };
        });
        setMapaPrecios(mapa);
      } else {
        setMapaPrecios({});
      }
    }
    setCargando(false);
  }

  const sinFamilia = contarSinFamilia(productos);
  const familias = familiasVistas(productos);

  const filasBase: FilaCatalogoAdmin[] = useMemo(
    () =>
      productos.map((p) => {
        const { precio, stock } = precioStockDe(p, mapaPrecios);
        return {
          id: p.id,
          codigo: codigosDe(p).join(', ') || '—',
          titulo: p.titulo,
          familia: p.familia,
          mundoSlug: p.mundo,
          mundoNombre: mundos.find((m) => m.slug === p.mundo)?.nombre || p.mundo,
          stock,
          precio,
          publicado: p.publicado
        };
      }),
    [productos, mapaPrecios, mundos]
  );

  const filas = useMemo(
    () =>
      ordenarCatalogo(
        filtrarCatalogo(filasBase, { busqueda, familia: familiaFiltro, mundoSlug: mundoFiltro }),
        columna,
        direccion
      ),
    [filasBase, busqueda, familiaFiltro, mundoFiltro, columna, direccion]
  );

  // Un filtro nuevo puede esconder filas que estaban seleccionadas —
  // limpiar la selección evita actuar "en lote" sobre algo que ya no se ve
  // ni se recuerda haber elegido. Ordenar (columna/dirección) no cambia
  // QUÉ está seleccionado, sólo el orden, así que no limpia acá.
  useEffect(() => {
    setSeleccionados(new Set());
    setPasoPrecio(false);
    setConfirmarEliminar(false);
    setPorcentaje('');
    setLoteError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, familiaFiltro, mundoFiltro]);

  const estadoEncabezado = estadoSeleccionEncabezado(filas, seleccionados);

  function alternarSeleccionTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (estadoEncabezado === 'todos') {
        filas.forEach((f) => next.delete(f.id));
      } else {
        filas.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }

  function alternarSeleccionUna(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
    setPasoPrecio(false);
    setConfirmarEliminar(false);
    setPorcentaje('');
    setLoteError('');
  }

  function productosSeleccionados(): ProductoAdmin[] {
    return productos.filter((p) => seleccionados.has(p.id));
  }

  async function ejecutarAjustePrecio() {
    const pct = Number(porcentaje);
    if (!porcentaje || Number.isNaN(pct)) return;
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const codigos = Array.from(new Set(productosSeleccionados().flatMap((p) => codigosDe(p))));
      const actualizaciones = codigos
        .map((c) => ({ codigo: c, actual: mapaPrecios[c]?.precio }))
        .filter((x): x is { codigo: string; actual: number } => x.actual != null);
      await Promise.all(
        actualizaciones.map(({ codigo, actual }) =>
          sb.from('catalogo_precios').update({ precio: redondearPrecio(actual, pct) }).eq('codigo', codigo)
        )
      );
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  async function ejecutarSacarDeUso() {
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const { error: err } = await sb
        .from('catalogo_productos')
        .update({ publicado: false })
        .in('id', Array.from(seleccionados));
      if (err) throw err;
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  async function ejecutarEliminarLote() {
    setLoteCargando(true);
    setLoteError('');
    try {
      const sb = supabaseBrowser();
      const seleccion = productosSeleccionados();
      const borrables = codigosBorrablesLote(seleccion, productos);
      const rutasStorage = Array.from(new Set(seleccion.flatMap((p) => rutasDeStorage(p.fotos || []))));
      if (rutasStorage.length) {
        await sb.storage.from('catalogo').remove(rutasStorage);
      }
      if (borrables.length) {
        await sb.from('catalogo_precios').delete().in('codigo', borrables);
      }
      const { error: err } = await sb.from('catalogo_productos').delete().in('id', Array.from(seleccionados));
      if (err) throw err;
      limpiarSeleccion();
      await cargar();
    } catch (err) {
      setLoteError((err as Error).message);
    } finally {
      setLoteCargando(false);
    }
  }

  function alOrdenar(col: ColumnaOrdenCatalogo) {
    if (columna === col) {
      setDireccion((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setColumna(col);
      setDireccion('asc');
    }
  }

  function SortIcon({ col }: { col: ColumnaOrdenCatalogo }) {
    if (columna !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    return direccion === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  function actualizarLocal(id: string, campos: Partial<ProductoAdmin>) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...campos } : p)));
    setSeleccionado((prev) => (prev && prev.id === id ? { ...prev, ...campos } : prev));
  }

  function quitarLocal(id: string) {
    setProductos((prev) => prev.filter((p) => p.id !== id));
    setSeleccionado((prev) => (prev && prev.id === id ? null : prev));
  }

  if (cargando) return <p className="adm-detalle-solo-lectura">Cargando…</p>;

  return (
    <div className="space-y-3">
      <ProductoEditModal
        producto={seleccionado}
        familiasConocidas={familias}
        mundosConocidos={mundos}
        todos={productos}
        mapaPrecios={mapaPrecios}
        onCerrar={() => setSeleccionado(null)}
        onActualizado={actualizarLocal}
        onEliminado={quitarLocal}
      />
      <div className="adm-lista-toolbar flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por título o código"
          aria-label="Buscar productos"
          className="sm:w-64"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select value={familiaFiltro || '__todas__'} onValueChange={(v) => setFamiliaFiltro(v === '__todas__' ? '' : (v as string))}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por familia">
            <SelectValue placeholder="Todas las familias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas las familias</SelectItem>
            <SelectItem value={SIN_FAMILIA}>— sin familia — ({sinFamilia})</SelectItem>
            {familias.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mundoFiltro || '__todos__'} onValueChange={(v) => setMundoFiltro(v === '__todos__' ? '' : (v as string))}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por mundo">
            <SelectValue placeholder="Todos los mundos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los mundos</SelectItem>
            {mundos.map((m) => (
              <SelectItem key={m.slug} value={m.slug}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {seleccionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="shrink-0 text-sm font-medium">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            {estadoEncabezado === 'todos' && filas.length > 1 ? ` (los ${filas.length} filtrados)` : ''}
          </span>

          {!pasoPrecio && !confirmarEliminar && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={loteCargando} onClick={() => setPasoPrecio(true)}>
                <Percent className="mr-1.5 h-3.5 w-3.5" />
                Ajustar precio
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={loteCargando} onClick={ejecutarSacarDeUso}>
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                Sacar de uso
              </Button>
              <Button type="button" variant="destructive" size="sm" disabled={loteCargando} onClick={() => setConfirmarEliminar(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Eliminar
              </Button>
            </>
          )}

          {pasoPrecio && (
            <>
              <span className="text-sm text-muted-foreground">Ajuste %</span>
              <Input
                type="number"
                className="w-24"
                placeholder="Ej: 10"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && porcentaje && ejecutarAjustePrecio()}
              />
              <span className="text-xs text-muted-foreground">(negativo para bajar)</span>
              <Button type="button" size="sm" disabled={loteCargando || !porcentaje} onClick={ejecutarAjustePrecio}>
                {loteCargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPasoPrecio(false); setPorcentaje(''); }}>
                Cancelar
              </Button>
            </>
          )}

          {confirmarEliminar && (
            <>
              <span className="text-sm font-medium text-destructive">
                ¿Eliminar {seleccionados.size} producto{seleccionados.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.
              </span>
              <Button type="button" variant="destructive" size="sm" disabled={loteCargando} onClick={ejecutarEliminarLote}>
                {loteCargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar eliminación'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarEliminar(false)}>
                Cancelar
              </Button>
            </>
          )}

          <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={limpiarSeleccion}>
            Limpiar selección
          </Button>
        </div>
      )}
      {loteError && <p className="adm-msg adm-msg-error">{loteError}</p>}

      <Table className="adm-lista-tabla">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={estadoEncabezado === 'todos'}
                indeterminate={estadoEncabezado === 'algunos'}
                onCheckedChange={alternarSeleccionTodos}
                aria-label="Seleccionar todos"
              />
            </TableHead>
            {COLUMNAS.map(({ col, label, alinear }) => (
              <TableHead
                key={col}
                className={'cursor-pointer select-none whitespace-nowrap hover:text-foreground' + (alinear === 'right' ? ' text-right' : '')}
                onClick={() => alOrdenar(col)}
              >
                {label}
                <SortIcon col={col} />
              </TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNAS.length + 2} className="adm-detalle-solo-lectura text-center">
                No hay artículos que coincidan.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((f) => (
              <TableRow key={f.id} className={seleccionados.has(f.id) ? 'bg-muted/30' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={seleccionados.has(f.id)}
                    onCheckedChange={() => alternarSeleccionUna(f.id)}
                    aria-label={`Seleccionar ${f.titulo}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{f.codigo}</TableCell>
                <TableCell className="font-medium">{f.titulo}</TableCell>
                <TableCell>{f.familia || <span className="adm-badge-sin-stock">sin familia</span>}</TableCell>
                <TableCell>{f.mundoNombre}</TableCell>
                <TableCell className="text-right">{f.stock == null ? '—' : f.stock}</TableCell>
                <TableCell className="text-right">{f.precio == null ? '—' : fmt.format(f.precio)}</TableCell>
                <TableCell>{f.publicado ? 'Visible' : 'Oculto'}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const p = productos.find((prod) => prod.id === f.id);
                      if (p) setSeleccionado(p);
                    }}
                  >
                    Editar
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
