'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProductoPublico, Variante } from '@/lib/catalogo-familia';
import { slugifyMundo } from '@/lib/catalogo-mundo';
import {
  validarCodigo,
  codigoNormalizado,
  codigosBorrables,
  rutasDeStorage,
  nuevaVarianteVacia,
  primerErrorDeVariantes,
  normalizarVariantes,
  type MapaPreciosAdmin
} from '@/lib/admin-catalogo';
import { procesarFoto, subirFoto } from '@/lib/procesar-foto';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const fmtPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export type ProductoAdmin = ProductoPublico & { publicado: boolean };

/**
 * Borrado definitivo — compartido entre este modal (un producto) y el
 * borrado en lote de PublicadoTab.tsx (varios). `borrables` lo calcula
 * cada caller (codigosBorrables para uno, codigosBorrablesLote para
 * varios) porque el criterio de "quién más usa este código" cambia según
 * si se borra de a uno o en lote — ver el comentario de
 * codigosBorrablesLote en lib/admin-catalogo.ts.
 */
export async function borrarProductoYPrecios(
  sb: ReturnType<typeof supabaseBrowser>,
  producto: Pick<ProductoAdmin, 'id' | 'fotos'>,
  borrables: string[]
) {
  const rutasStorage = rutasDeStorage(producto.fotos || []);
  if (rutasStorage.length) {
    await sb.storage.from('catalogo').remove(rutasStorage);
  }
  if (borrables.length) {
    await sb.from('catalogo_precios').delete().in('codigo', borrables);
  }
  const { error } = await sb.from('catalogo_productos').delete().eq('id', producto.id);
  if (error) throw error;
}

/**
 * Modal de edición de un producto publicado (Sprints 3-4 del plan de
 * catálogo admin, SPEC-catalogo-admin-variantes.md secciones 5) — antes
 * era una pantalla que reemplazaba la lista (DetalleProducto dentro de
 * PublicadoTab.tsx); ahora es un Dialog que se superpone a la tabla, que
 * sigue montada detrás. Reordenado respecto a la pantalla vieja: Código ·
 * Nombre · Mundo · Familia arriba, editor de variantes, Descripción,
 * toggle de carrusel del home, fotos generales al fondo.
 *
 * Editor de variantes (Sprint 4): agregar/quitar filas de talle y/o
 * tipo/color, cada una con su propio código, imagen e "a la venta"
 * (activo). Precio/stock de cada fila son de sólo lectura (vienen de
 * `mapaPrecios`, la misma consulta batch que ya hace PublicadoTab.tsx
 * para toda la tabla — no se pide de nuevo acá). El código simple de
 * arriba y la lista de variantes son mutuamente excluyentes: tener 1+
 * variante deshabilita el código simple (pasa a null al guardar).
 *
 * La composición de combo (de sólo lectura) queda para el Sprint 6.
 */
export default function ProductoEditModal({
  producto,
  familiasConocidas,
  mundosConocidos,
  todos,
  mapaPrecios,
  onCerrar,
  onActualizado,
  onEliminado
}: {
  producto: ProductoAdmin | null;
  familiasConocidas: string[];
  mundosConocidos: { slug: string; nombre: string }[];
  todos: ProductoAdmin[];
  mapaPrecios: MapaPreciosAdmin;
  onCerrar: () => void;
  onActualizado: (id: string, campos: Partial<ProductoAdmin>) => void;
  onEliminado: (id: string) => void;
}) {
  if (!producto) return null;
  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <FormularioProducto
          key={producto.id}
          producto={producto}
          familiasConocidas={familiasConocidas}
          mundosConocidos={mundosConocidos}
          todos={todos}
          mapaPrecios={mapaPrecios}
          onCerrar={onCerrar}
          onActualizado={onActualizado}
          onEliminado={onEliminado}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormularioProducto({
  producto,
  familiasConocidas,
  mundosConocidos,
  todos,
  mapaPrecios,
  onCerrar,
  onActualizado,
  onEliminado
}: {
  producto: ProductoAdmin;
  familiasConocidas: string[];
  mundosConocidos: { slug: string; nombre: string }[];
  todos: ProductoAdmin[];
  mapaPrecios: MapaPreciosAdmin;
  onCerrar: () => void;
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
  const [destacadoHome, setDestacadoHome] = useState(!!producto.destacadoHome);
  const [variantes, setVariantes] = useState<Variante[]>(producto.variantes || []);
  const [errorVariantes, setErrorVariantes] = useState<string | null>(null);
  const [subiendoVarianteIdx, setSubiendoVarianteIdx] = useState<number | null>(null);
  const [fotos, setFotos] = useState(producto.fotos || []);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Reactivo, no una foto fija del producto original: agregar la primera
  // variante o quitar la última cambia si el código simple de arriba se
  // edita o queda deshabilitado, en el mismo guardado (sin recargar).
  const tieneVariantes = variantes.length > 0;

  function onCambiarCodigo(v: string) {
    setCodigo(v);
    setErrorCodigo(validarCodigo(v));
  }

  function agregarVariante() {
    setVariantes((prev) => [...prev, nuevaVarianteVacia()]);
  }

  function quitarVariante(i: number) {
    setVariantes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function actualizarVariante(i: number, campo: 'talle' | 'tipo' | 'codigo', valor: string) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)));
  }

  function alternarActivoVariante(i: number, activo: boolean) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, activo } : v)));
  }

  async function subirImagenVariante(i: number, file: File) {
    setSubiendoVarianteIdx(i);
    setError('');
    try {
      const blob = await procesarFoto(file);
      const carpeta = producto.familia ? producto.familia.toLowerCase().replace(/\s+/g, '-') : 'productos';
      const url = await subirFoto(supabaseBrowser(), blob, carpeta, `${producto.slug}-variante-${i}`, 1);
      setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, imagen: url } : v)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendoVarianteIdx(null);
    }
  }

  async function guardar() {
    if (!tieneVariantes) {
      const err = validarCodigo(codigo);
      if (err) {
        setErrorCodigo(err);
        return;
      }
    }
    const errVar = tieneVariantes ? primerErrorDeVariantes(variantes) : null;
    setErrorVariantes(errVar);
    if (errVar) return;

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
    const variantesFinal = tieneVariantes ? normalizarVariantes(variantes) : null;
    // dbCampos usa nombres de columna (snake_case donde corresponde,
    // destacado_home) — nunca se manda tal cual a onActualizado porque el
    // tipo local (ProductoPublico) usa destacadoHome (camelCase, mismo
    // alias que ya devuelve la RPC pública).
    const dbCampos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      codigo: tieneVariantes ? null : codigoNormalizado(codigo),
      variantes: variantesFinal,
      familia: familiaFinal,
      mundo: mundoFinal,
      fotos,
      destacado_home: destacadoHome
    };
    const { error: err2 } = await sb.from('catalogo_productos').update(dbCampos).eq('id', producto.id);
    setGuardando(false);
    if (err2) {
      setError(err2.message);
      return;
    }
    onActualizado(producto.id, {
      titulo: dbCampos.titulo,
      descripcion: dbCampos.descripcion,
      codigo: dbCampos.codigo,
      variantes: dbCampos.variantes,
      familia: dbCampos.familia,
      mundo: dbCampos.mundo,
      fotos: dbCampos.fotos,
      destacadoHome
    });
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
      await borrarProductoYPrecios(sb, { id: producto.id, fotos }, codigosBorrables(producto, todos));
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
      <DialogHeader>
        <DialogTitle>{producto.titulo}</DialogTitle>
      </DialogHeader>

      <div className="adm-detalle-campos-editables">
        <div className="adm-detalle-campo">
          <label>
            Código {tieneVariantes ? '(este producto tiene variantes — se editan en la lista de abajo)' : ''}
            <input
              type="text"
              value={tieneVariantes ? variantes.map((v) => v.codigo).join(', ') : codigo}
              onChange={(e) => onCambiarCodigo(e.target.value)}
              disabled={tieneVariantes}
            />
          </label>
          {errorCodigo && <p className="adm-msg adm-msg-error">{errorCodigo}</p>}
        </div>
        <div className="adm-detalle-campo">
          <label>
            Nombre
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
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
        <div className="adm-detalle-campo">
          <p>Variantes (talle y/o tipo/color — cada una es un artículo distinto de Búho, con su propio código)</p>
          <div className="flex flex-col gap-3">
            {variantes.map((v, i) => {
              const precioStock = mapaPrecios[v.codigo];
              return (
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-input p-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Talle
                    <input type="text" value={v.talle || ''} onChange={(e) => actualizarVariante(i, 'talle', e.target.value)} placeholder="Ej: Chico" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Tipo/Color
                    <input type="text" value={v.tipo || ''} onChange={(e) => actualizarVariante(i, 'tipo', e.target.value)} placeholder="Ej: Rojo" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Código
                    <input type="text" value={v.codigo} onChange={(e) => actualizarVariante(i, 'codigo', e.target.value)} />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={v.activo} onChange={(e) => alternarActivoVariante(i, e.target.checked)} />
                    A la venta
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {precioStock
                      ? `${fmtPrecio.format(precioStock.precio)} · stock ${precioStock.stock == null ? '—' : precioStock.stock}`
                      : 'Sin datos de precio todavía'}
                  </span>
                  {v.imagen && <img src={v.imagen} alt="" width={40} height={40} className="rounded object-cover" />}
                  <label className="flex flex-col gap-1 text-sm">
                    Imagen
                    <input
                      type="file"
                      accept="image/*"
                      disabled={subiendoVarianteIdx === i}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) subirImagenVariante(i, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button type="button" className="btn btn-ghost" onClick={() => quitarVariante(i)}>
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn mt-2" onClick={agregarVariante}>
            + Agregar variante
          </button>
          {errorVariantes && <p className="adm-msg adm-msg-error">{errorVariantes}</p>}
        </div>
        <div className="adm-detalle-campo">
          <label>
            Descripción
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
        </div>
        <div className="adm-detalle-campo flex items-center gap-2">
          <Switch id="destacado-home" checked={destacadoHome} onCheckedChange={setDestacadoHome} />
          <label htmlFor="destacado-home">Mostrar en el carrusel del home</label>
        </div>
      </div>

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
