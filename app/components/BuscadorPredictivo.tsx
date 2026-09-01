'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buscarCatalogo, type ProductoBuscado } from '@/lib/busqueda';
import { urlFoto } from '@/lib/catalogo-familia';
import { supabaseBrowser } from '@/lib/supabase';
import { plata } from '@/lib/envios';

/**
 * Buscador predictivo del Nav (Sprint 6, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * dropdown en desktop, pantalla completa en mobile (el shell de ambos
 * sigue viviendo en Nav.tsx, que sólo decide cuándo mostrar/ocultar este
 * componente). El `<form action="/explorar">` con Enter/submit nativo
 * (sin JS) que ya existía en Nav.tsx antes de este sprint se mantiene
 * intacto adentro — este componente sólo AGREGA la vista previa en vivo
 * por encima, vía `onChange` + debounce, sin tocar ese flujo.
 *
 * Precio: search resultados incluyen `precio` (join directo en el RPC,
 * lib/busqueda.ts) pero ese fetch vive detrás de `next:{tags}}` — el
 * mismo cache de ISR que el resto del catálogo, no "siempre fresco"
 * (regla dura del proyecto para precio/stock, ver CatalogoPrecios.tsx).
 * Por eso acá el precio se resuelve aparte, con el mismo RPC
 * `catalogo_publico()` pero llamado directo desde el browser
 * (`supabaseBrowser()`, sin la capa de fetch cacheado de Next) — un solo
 * fetch por apertura del buscador, no por tecla.
 */
type Props = {
  variante: 'desktop' | 'mobile';
  onCerrar: () => void;
};

function resaltar(texto: string, query: string) {
  const i = texto.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded-sm bg-yellow px-0.5">{texto.slice(i, i + query.length)}</mark>
      {texto.slice(i + query.length)}
    </>
  );
}

export default function BuscadorPredictivo({ variante, onCerrar }: Props) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ProductoBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [precios, setPrecios] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelado = false;
    supabaseBrowser()
      .rpc('catalogo_publico')
      .then(({ data, error }: { data: any; error: any }) => {
        // Ref hubiera sido más liviano, pero mutar .current no dispara
        // re-render — encontrado en el screenshot de verificación: el
        // precio llegaba bien pero nunca se pintaba (Sprint 6).
        if (!cancelado && !error && data) setPrecios(data.precios || {});
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    const texto = query.trim();
    if (texto.length < 2) {
      setResultados([]);
      setBuscado(false);
      return;
    }
    setBuscando(true);
    const id = setTimeout(() => {
      buscarCatalogo(texto, { limite: 6 }).then((r) => {
        setResultados(r.productos);
        setBuscando(false);
        setBuscado(true);
      });
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  const mostrarDropdown = variante === 'desktop' && (buscando || buscado);

  const listaResultados = (
    <ul className="flex flex-col" aria-label="Resultados de búsqueda">
      {resultados.map((p) => (
        <li key={p.id}>
          <Link
            href={'/' + p.mundo}
            onClick={onCerrar}
            className="flex items-center gap-s2 px-s2 py-s2 hover:bg-background-alt"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-brand bg-background">
              {p.fotos[0] ? (
                <img src={urlFoto(p.fotos[0].src)} alt="" width={48} height={48} className="h-full w-full object-contain" />
              ) : (
                <img src="/Logo/Mundo-Magico%20Logo.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-full opacity-60" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-body text-fs0 text-ink!">{resaltar(p.titulo, query.trim())}</span>
              {p.codigo && precios[p.codigo] != null && (
                <span className="block font-body text-fs-1 font-semibold text-ink!">{plata(precios[p.codigo])}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={variante === 'desktop' ? 'relative w-64' : 'flex flex-1 flex-col overflow-hidden'}>
      <form action="/explorar" className="flex items-center gap-s2">
        <input
          type="search"
          name="q"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar disfraces, globos, cotillón..."
          aria-label="Buscar"
          className={
            'flex-1 rounded-brand border border-line px-s2 font-body text-fs0 ' +
            (variante === 'desktop' ? 'py-1' : 'py-2')
          }
          onBlur={variante === 'desktop' ? () => setTimeout(onCerrar, 150) : undefined}
        />
        {variante === 'mobile' && (
          <button type="button" onClick={onCerrar} className="shrink-0 font-body text-fs-1 text-muted">
            Cancelar
          </button>
        )}
      </form>

      {mostrarDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[70vh] overflow-y-auto rounded-brand border border-line bg-surface shadow-lg">
          {buscando && resultados.length === 0 ? (
            <p className="px-s2 py-s3 text-center font-body text-fs-1 text-muted">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-s2 py-s3 text-center font-body text-fs-1 text-muted">
              Sin resultados para &quot;{query.trim()}&quot;
            </p>
          ) : (
            <>
              {listaResultados}
              <Link
                href={'/explorar?q=' + encodeURIComponent(query.trim())}
                onClick={onCerrar}
                className="block border-t border-line px-s2 py-s2 text-center font-body text-fs-1 font-semibold text-green-ink!"
              >
                Ver todos los resultados →
              </Link>
            </>
          )}
        </div>
      )}

      {variante === 'mobile' && (
        <div className="mt-s3 flex-1 overflow-y-auto">
          {buscando && resultados.length === 0 ? (
            <p className="py-s4 text-center font-body text-fs-1 text-muted">Buscando…</p>
          ) : buscado && resultados.length === 0 ? (
            <p className="py-s4 text-center font-body text-fs-1 text-muted">
              Sin resultados para &quot;{query.trim()}&quot;
            </p>
          ) : resultados.length > 0 ? (
            <>
              {listaResultados}
              <Link
                href={'/explorar?q=' + encodeURIComponent(query.trim())}
                onClick={onCerrar}
                className="mt-s2 block rounded-brand bg-green px-s3 py-s2 text-center font-body text-fs0 font-semibold text-white!"
              >
                Ver todos los resultados →
              </Link>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
