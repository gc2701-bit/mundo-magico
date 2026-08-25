'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import { slugifyMundo } from '@/lib/catalogo-mundo';
import {
  validarCodigo,
  codigoNormalizado,
  codigosDe,
  codigosBorrables,
  familiasVistas,
  contarSinFamilia,
  rutasDeStorage,
  precioStockDe,
  ordenarCatalogo,
  filtrarCatalogo,
  SIN_FAMILIA,
  type MapaPreciosAdmin,
  type FilaCatalogoAdmin,
  type ColumnaOrdenCatalogo
} from '@/lib/admin-catalogo';
import { procesarFoto, subirFoto } from '@/lib/procesar-foto';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

type ProductoAdmin = ProductoPublico & { publicado: boolean };

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
      .select('id, titulo, slug, codigo, specs, descripcion, tags, variantes, fotos, familia, publicado, mundo, subcategoriaId:subcategoria_id, orden')
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

  if (seleccionado) {
    return (
      <DetalleProducto
        producto={seleccionado}
        familiasConocidas={familias}
        mundosConocidos={mundos}
        todos={productos}
        onVolver={() => setSeleccionado(null)}
        onActualizado={actualizarLocal}
        onEliminado={quitarLocal}
      />
    );
  }

  return (
    <div className="space-y-3">
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
      <Table className="adm-lista-tabla">
        <TableHeader>
          <TableRow>
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
              <TableCell colSpan={COLUMNAS.length + 1} className="adm-detalle-solo-lectura text-center">
                No hay artículos que coincidan.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((f) => (
              <TableRow key={f.id}>
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

function DetalleProducto({
  producto,
  familiasConocidas,
  mundosConocidos,
  todos,
  onVolver,
  onActualizado,
  onEliminado
}: {
  producto: ProductoAdmin;
  familiasConocidas: string[];
  mundosConocidos: { slug: string; nombre: string }[];
  todos: ProductoAdmin[];
  onVolver: () => void;
  onActualizado: (id: string, campos: Partial<ProductoAdmin>) => void;
  onEliminado: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState(producto.titulo);
  const [descripcion, setDescripcion] = useState(producto.descripcion || '');
  const [codigo, setCodigo] = useState(producto.codigo || '');
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [familia, setFamilia] = useState(producto.familia || '');
  const [familiaNueva, setFamiliaNueva] = useState('');
  const [mundo, setMundo] = useState(producto.mundo);
  const [mundoNuevo, setMundoNuevo] = useState('');
  const [fotos, setFotos] = useState(producto.fotos || []);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const esTalles = !!(producto.variantes && producto.variantes.length);

  function onCambiarCodigo(v: string) {
    setCodigo(v);
    setErrorCodigo(validarCodigo(v));
  }

  async function guardar() {
    const err = validarCodigo(codigo);
    if (err) {
      setErrorCodigo(err);
      return;
    }
    const mundoNuevoTrim = mundoNuevo.trim();
    const mundoFinal = mundoNuevoTrim ? slugifyMundo(mundoNuevoTrim) : mundo;
    if (!mundoFinal) {
      setError('Elegí a qué mundo pertenece antes de guardar.');
      return;
    }
    setGuardando(true);
    setError('');
    const sb = supabaseBrowser();
    if (mundoNuevoTrim) {
      const { error: errMundo } = await sb
        .from('catalogo_mundos')
        .insert({ slug: mundoFinal, nombre: mundoNuevoTrim, orden: mundosConocidos.length + 1 });
      if (errMundo) {
        setGuardando(false);
        setError(errMundo.message);
        return;
      }
    }
    const familiaFinal = familiaNueva.trim() || familia || null;
    const campos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      codigo: esTalles ? producto.codigo : codigoNormalizado(codigo),
      familia: familiaFinal,
      mundo: mundoFinal,
      fotos
    };
    const { error: err2 } = await sb.from('catalogo_productos').update(campos).eq('id', producto.id);
    setGuardando(false);
    if (err2) {
      setError(err2.message);
      return;
    }
    onActualizado(producto.id, campos as Partial<ProductoAdmin>);
    setMensaje('Guardado.');
  }

  async function alternarPublicado() {
    const nuevo = !producto.publicado;
    const sb = supabaseBrowser();
    const { error: err } = await sb.from('catalogo_productos').update({ publicado: nuevo }).eq('id', producto.id);
    if (err) {
      setError(err.message);
      return;
    }
    onActualizado(producto.id, { publicado: nuevo });
    setMensaje(nuevo ? 'Publicado.' : 'Sacado de la web (reversible).');
  }

  async function eliminarDefinitivo() {
    const ok = window.confirm(`Esto borra "${producto.titulo}" para siempre, sin poder deshacerlo. ¿Seguro?`);
    if (!ok) return;
    setGuardando(true);
    setError('');
    try {
      const sb = supabaseBrowser();

      const rutasStorage = rutasDeStorage(fotos);
      if (rutasStorage.length) {
        await sb.storage.from('catalogo').remove(rutasStorage);
      }

      const borrables = codigosBorrables(producto, todos);
      if (borrables.length) {
        await sb.from('catalogo_precios').delete().in('codigo', borrables);
      }

      const { error: err } = await sb.from('catalogo_productos').delete().eq('id', producto.id);
      if (err) throw err;

      onEliminado(producto.id);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  }

  async function agregarFoto(file: File) {
    setSubiendoFoto(true);
    setError('');
    try {
      const blob = await procesarFoto(file);
      const carpeta = producto.familia ? producto.familia.toLowerCase().replace(/\s+/g, '-') : 'productos';
      const url = await subirFoto(supabaseBrowser(), blob, carpeta, producto.slug, fotos.length + 1);
      setFotos((prev) => [...prev, { src: url, cap: '' }]);
      setMensaje('Foto lista — apretá "Guardar" para dejarla en el producto.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <div className="adm-detalle">
      <button type="button" className="btn btn-ghost adm-detalle-volver" onClick={onVolver}>
        Volver a la lista
      </button>
      <h2>{producto.titulo}</h2>

      <div className="adm-detalle-fotos">
        {fotos.map((f, i) => (
          <figure key={i}>
            <img src={f.src.startsWith('http') ? f.src : '/' + f.src} alt={f.cap || producto.titulo} />
            <button type="button" className="adm-detalle-quitar-foto" onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}>
              Quitar
            </button>
          </figure>
        ))}
      </div>
      <div className="adm-detalle-campo">
        <label>
          Agregar foto (se ajusta sola a 1080×1080 con fondo blanco)
          <input
            type="file"
            accept="image/*"
            disabled={subiendoFoto}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) agregarFoto(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="adm-detalle-campos-editables">
        <div className="adm-detalle-campo">
          <label>
            Título
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
        </div>
        <div className="adm-detalle-campo">
          <label>
            Descripción
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
        </div>
        <div className="adm-detalle-campo">
          <label>
            Código {esTalles ? '(este producto tiene talles — el código de cada opción no se edita acá)' : ''}
            <input
              type="text"
              value={esTalles ? codigosDe(producto).join(', ') : codigo}
              onChange={(e) => onCambiarCodigo(e.target.value)}
              disabled={esTalles}
            />
          </label>
          {errorCodigo && <p className="adm-msg adm-msg-error">{errorCodigo}</p>}
        </div>
        <div className="adm-detalle-campo">
          <label>
            Mundo (categorización pública, obligatorio)
            <select value={mundo} onChange={(e) => { setMundo(e.target.value); setMundoNuevo(''); }}>
              {mundosConocidos.map((m) => (
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
        <div className="adm-detalle-campo">
          <label>
            Familia (dato interno, sólo referencia — lo manda Búho)
            <select value={familia} onChange={(e) => { setFamilia(e.target.value); setFamiliaNueva(''); }}>
              <option value="">— sin familia —</option>
              {familiasConocidas.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            o escribir una nueva
            <input type="text" value={familiaNueva} onChange={(e) => setFamiliaNueva(e.target.value)} placeholder="Nombre de familia nueva" />
          </label>
        </div>
      </div>

      {mensaje && <p className="adm-msg adm-msg-ok">{mensaje}</p>}
      {error && <p className="adm-msg adm-msg-error">{error}</p>}

      <button type="button" className="btn btn-primary adm-detalle-guardar" disabled={guardando} onClick={guardar}>
        Guardar
      </button>
      <button type="button" className="btn" disabled={guardando} onClick={alternarPublicado}>
        {producto.publicado ? 'Sacar de la web' : 'Publicar'}
      </button>
      <button type="button" className="btn" disabled={guardando} onClick={eliminarDefinitivo}>
        Eliminar definitivamente
      </button>
    </div>
  );
}
