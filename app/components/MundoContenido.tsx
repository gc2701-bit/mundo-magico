'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { listarCatalogo, buscarCatalogo, type ProductoBase, type ProductoListado, type ProductoBuscado } from '@/lib/busqueda';
import { siguienteCursorListado, siguienteCursorBusqueda } from '@/lib/busqueda-cursor';
import Breadcrumbs from './Breadcrumbs';
import ProductoCard from './ProductoCard';
import EmptyState from './EmptyState';
import { GrillaSkeleton } from './ProductoCardSkeleton';

/**
 * Breadcrumbs + título + filtros + grilla + "Cargar más" de una página de
 * mundo o de Explorar (Sprint 5, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * Client Component: arranca con la primera página ya resuelta en el
 * server (SSR/ISR, sin parpadeo inicial) y a partir de ahí llama a
 * `listarCatalogo` (Server Action, lib/busqueda.ts) en cada cambio de
 * filtro o "Cargar más" — paginado por cursor, nunca OFFSET.
 *
 * `mundoSlug` es `undefined` en Explorar: ahí "Mundo" es un filtro más
 * (no un segmento de URL), y "Familia" se habilita recién cuando se
 * elige uno — no tiene sentido mostrar familias mezclando mundos.
 *
 * El breadcrumb y el <h1> viven acá adentro (no en la page) a propósito:
 * el tercer nivel del breadcrumb (`Inicio › Mundo › Familia`) depende del
 * filtro de familia activo, que es estado de cliente — no se puede
 * resolver en el server component de la page.
 *
 * Modo búsqueda (Sprint 6): si la URL trae `?q=`, se dispara
 * `buscarCatalogo` client-side y reemplaza la lista server-rendered.
 * `useSearchParams()` fuerza al Client Component tree hasta el `Suspense`
 * más cercano a renderizarse sólo client-side — por eso NO se llama
 * directo acá (haría que TODO el breadcrumb/h1/grilla dejaran de servirse
 * como HTML estático real, aunque no haya `?q=` en la URL). Se aísla en
 * `LectorQueryUrl`, un leaf sin salida visual envuelto en su propio
 * `<Suspense>` al final del archivo — el resto de este componente sigue
 * siendo HTML estático de verdad, y sólo se entera de la búsqueda vía el
 * callback `onQuery`, después de hidratar.
 *
 * Con búsqueda activa, `listarCatalogo` se reemplaza por `buscarCatalogo`
 * en TODO — filtros, "Cargar más" — hasta que se limpia la búsqueda.
 * `soloStock` no aplica ahí: `catalogo_buscar()` no tiene ese parámetro
 * (Sprint 1, ranking por relevancia no cruza con ese filtro).
 */
type ProductoItem = ProductoBase & { score?: number };

type Props = {
  mundoSlug?: string;
  mundoNombre?: string;
  tituloExplorar?: string;
  mundos?: { slug: string; nombre: string }[];
  familiasPorMundo: Record<string, string[]>;
  productosIniciales: ProductoBase[];
  hayMasInicial: boolean;
};

function LectorQueryUrl({ onQuery }: { onQuery: (q: string) => void }) {
  const q = (useSearchParams().get('q') || '').trim();
  useEffect(() => {
    if (q.length >= 2) onQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return null;
}

export default function MundoContenido({
  mundoSlug,
  mundoNombre,
  tituloExplorar = 'Explorar el catálogo',
  mundos = [],
  familiasPorMundo,
  productosIniciales,
  hayMasInicial,
}: Props) {
  const router = useRouter();

  const [mundo, setMundo] = useState<string | undefined>(mundoSlug);
  const [familia, setFamilia] = useState<string | undefined>(undefined);
  const [soloStock, setSoloStock] = useState(false);
  const [query, setQuery] = useState<string>('');
  const [productos, setProductos] = useState<ProductoItem[]>(productosIniciales);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(false);
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  function iniciarBusquedaDesdeUrl(q: string) {
    if (q === query) return;
    setQuery(q);
    setCargando(true);
    buscarCatalogo(q, { mundo, familia, limite: 24 }).then((r) => {
      setProductos(r.productos);
      setHayMas(r.hayMas);
      setCargando(false);
    });
  }

  const familiasDisponibles = mundo ? familiasPorMundo[mundo] || [] : [];
  const hayFiltrosActivos = !!familia || soloStock || (!mundoSlug && !!mundo);

  const crumbs = mundoSlug
    ? [
        { label: 'Inicio', href: '/' },
        familia ? { label: mundoNombre ?? '', href: `/${mundoSlug}` } : { label: mundoNombre ?? '' },
        ...(familia ? [{ label: familia }] : []),
      ]
    : [{ label: 'Inicio', href: '/' }, { label: 'Explorar' }];
  const titulo = mundoSlug ? mundoNombre ?? '' : tituloExplorar;

  async function recargar(params: { mundo?: string; familia?: string; soloStock: boolean }, queryActiva = query) {
    setCargando(true);
    const r = queryActiva
      ? await buscarCatalogo(queryActiva, { mundo: params.mundo, familia: params.familia, limite: 24 })
      : await listarCatalogo({
          mundo: params.mundo,
          familia: params.familia,
          soloStock: params.soloStock,
          limite: 24,
        });
    setProductos(r.productos);
    setHayMas(r.hayMas);
    setCargando(false);
  }

  function onMundoChange(nuevo: string | undefined) {
    setMundo(nuevo);
    setFamilia(undefined);
    recargar({ mundo: nuevo, familia: undefined, soloStock });
  }
  function onFamiliaChange(f: string | undefined) {
    setFamilia(f);
    recargar({ mundo, familia: f, soloStock });
  }
  function onStockChange(v: boolean) {
    setSoloStock(v);
    recargar({ mundo, familia, soloStock: v });
  }
  function limpiarFiltros() {
    setFamilia(undefined);
    setSoloStock(false);
    if (!mundoSlug) setMundo(undefined);
    recargar({ mundo: mundoSlug, familia: undefined, soloStock: false });
  }
  function limpiarBusqueda() {
    setQuery('');
    router.replace(mundoSlug ? `/${mundoSlug}` : '/explorar');
    recargar({ mundo, familia, soloStock }, '');
  }

  async function cargarMas() {
    setCargando(true);
    if (query) {
      const cursor = siguienteCursorBusqueda(productos as ProductoBuscado[]);
      const r = await buscarCatalogo(query, { mundo, familia, cursor, limite: 24 });
      setProductos((prev) => [...prev, ...r.productos]);
      setHayMas(r.hayMas);
    } else {
      const cursor = siguienteCursorListado(productos as ProductoListado[]);
      const r = await listarCatalogo({ mundo, familia, soloStock, cursor, limite: 24 });
      setProductos((prev) => [...prev, ...r.productos]);
      setHayMas(r.hayMas);
    }
    setCargando(false);
  }

  const filtrosUI = (
    <div className="flex flex-col gap-s3">
      {!mundoSlug && (
        <div>
          <div className="label mb-1">Mundo</div>
          <div className="flex flex-col gap-1">
            {mundos.map((m) => (
              <label key={m.slug} className="flex items-center gap-2 font-body text-fs0 text-ink">
                <input
                  type="checkbox"
                  checked={mundo === m.slug}
                  onChange={() => onMundoChange(mundo === m.slug ? undefined : m.slug)}
                />
                {m.nombre}
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="label mb-1">Familia</div>
        {mundo ? (
          familiasDisponibles.length ? (
            <div className="flex flex-col gap-1">
              {familiasDisponibles.map((f) => (
                <label key={f} className="flex items-center gap-2 font-body text-fs0 text-ink">
                  <input
                    type="checkbox"
                    checked={familia === f}
                    onChange={() => onFamiliaChange(familia === f ? undefined : f)}
                  />
                  {f}
                </label>
              ))}
            </div>
          ) : (
            <p className="font-body text-fs-1 text-muted">Sin familias cargadas todavía en este mundo.</p>
          )
        ) : (
          <p className="font-body text-fs-1 text-muted">Elegí un mundo para filtrar por familia.</p>
        )}
      </div>
      {!query && (
        <label className="flex items-center gap-2 font-body text-fs0 text-ink">
          <input type="checkbox" checked={soloStock} onChange={(e) => onStockChange(e.target.checked)} />
          Solo con stock
        </label>
      )}
      {hayFiltrosActivos && (
        <button type="button" onClick={limpiarFiltros} className="self-start font-body text-fs-1 font-semibold text-green-ink!">
          Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <Suspense fallback={null}>
        <LectorQueryUrl onQuery={iniciarBusquedaDesdeUrl} />
      </Suspense>
      <div className="wrap pt-s3">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-s2 font-display text-fs4 text-ink">{titulo}</h1>
      </div>
      <div className="wrap flex flex-col gap-s3 py-s5 md:flex-row md:items-start md:gap-s5">
        {/* Desktop — sidebar */}
        <aside className="hidden md:block md:w-56 md:shrink-0" aria-label="Filtros">
          {filtrosUI}
        </aside>

        {/* Mobile — botón que abre el bottom sheet */}
        <div className="flex gap-s2 md:hidden">
          <button
            type="button"
            onClick={() => setFiltroAbierto(true)}
            className="flex-1 rounded-brand border border-line bg-surface px-s3 py-s2 text-center font-body text-fs0 text-ink"
          >
            Filtrar{hayFiltrosActivos ? ' ·' : ''} ▾
          </button>
        </div>
        {filtroAbierto && (
          <div className="fixed inset-0 z-30 flex flex-col justify-end md:hidden" role="dialog" aria-label="Filtros">
            <button
              type="button"
              aria-label="Cerrar filtros"
              onClick={() => setFiltroAbierto(false)}
              className="flex-1 bg-ink/40"
            />
            <div className="max-h-[75vh] overflow-y-auto rounded-t-brand border-t border-line bg-surface p-s3">
              {filtrosUI}
              <button
                type="button"
                onClick={() => setFiltroAbierto(false)}
                className="mt-s3 w-full rounded-brand bg-green px-s3 py-s2 text-center font-body text-fs0 font-semibold text-white!"
              >
                Ver {productos.length} producto{productos.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1">
          {query && (
            <p className="mb-s2 font-body text-fs0 text-ink">
              Resultados para &quot;{query}&quot;{' '}
              <button type="button" onClick={limpiarBusqueda} className="font-semibold text-green-ink! underline">
                Ver catálogo completo
              </button>
            </p>
          )}
          {cargando && productos.length === 0 ? (
            <GrillaSkeleton />
          ) : productos.length ? (
            <>
              <p className="mb-s2 font-body text-fs-1 text-muted">{productos.length} producto{productos.length === 1 ? '' : 's'}{hayMas ? '+' : ''}</p>
              <div className="grid grid-cols-2 gap-s2 md:grid-cols-4 md:gap-s3">
                {productos.map((p) => (
                  <ProductoCard key={p.id} producto={p} precioOferta={p.precioOferta} />
                ))}
              </div>
              {hayMas && (
                <div className="mt-s5 flex justify-center">
                  <button
                    type="button"
                    onClick={cargarMas}
                    disabled={cargando}
                    className="rounded-brand border border-line bg-surface px-s4 py-s2 font-body text-fs0 font-semibold text-ink disabled:opacity-50"
                  >
                    {cargando ? 'Cargando…' : 'Cargar más ↓'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icono="🔍"
              titulo={query ? `Sin resultados para "${query}"` : 'No hay productos con estos filtros'}
              descripcion={query ? 'Probá con otra palabra o mirá el catálogo completo.' : 'Probá sacar algún filtro para ver más resultados.'}
            />
          )}
        </div>
      </div>
    </>
  );
}
