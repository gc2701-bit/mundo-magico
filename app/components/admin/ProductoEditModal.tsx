'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import { slugifyMundo } from '@/lib/catalogo-mundo';
import { validarCodigo, codigoNormalizado, codigosDe, codigosBorrables, rutasDeStorage } from '@/lib/admin-catalogo';
import { procesarFoto, subirFoto } from '@/lib/procesar-foto';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

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
 * Modal de edición de un producto publicado (Sprint 3 del plan de
 * catálogo admin, SPEC-catalogo-admin-variantes.md sección 5) — antes era
 * una pantalla que reemplazaba la lista (DetalleProducto dentro de
 * PublicadoTab.tsx); ahora es un Dialog que se superpone a la tabla, que
 * sigue montada detrás. Reordenado respecto a la pantalla vieja: Código ·
 * Nombre · Mundo · Familia arriba (en ese orden, pedido explícito del
 * brainstorming), fotos generales al fondo (antes arriba).
 *
 * El editor de variantes y la composición de combo (de sólo lectura)
 * quedan para los Sprints 4 y 6 — acá el código simple se edita como
 * siempre, sin tocar `variantes` todavía.
 */
export default function ProductoEditModal({
  producto,
  familiasConocidas,
  mundosConocidos,
  todos,
  onCerrar,
  onActualizado,
  onEliminado
}: {
  producto: ProductoAdmin | null;
  familiasConocidas: string[];
  mundosConocidos: { slug: string; nombre: string }[];
  todos: ProductoAdmin[];
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
  onCerrar,
  onActualizado,
  onEliminado
}: {
  producto: ProductoAdmin;
  familiasConocidas: string[];
  mundosConocidos: { slug: string; nombre: string }[];
  todos: ProductoAdmin[];
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
    // dbCampos usa nombres de columna (snake_case donde corresponde,
    // destacado_home) — nunca se manda tal cual a onActualizado porque el
    // tipo local (ProductoPublico) usa destacadoHome (camelCase, mismo
    // alias que ya devuelve la RPC pública).
    const dbCampos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      codigo: esTalles ? producto.codigo : codigoNormalizado(codigo),
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
