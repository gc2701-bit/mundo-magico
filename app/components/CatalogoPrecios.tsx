'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { resolverEstadoProducto } from '@/lib/precios-familia';

/**
 * Hidrata precio/stock client-side después de que la página (ISR) ya se
 * sirvió estática — un solo fetch a catalogo_publico() (mismo RPC del
 * sitio viejo), aplicado a todas las tarjetas con data-codigo o
 * data-talles-codigos. Se monta una sola vez por página (ver
 * app/[familia]/page.tsx) — nunca por tarjeta, para no repetir el fetch.
 *
 * Un cambio de precio se ve instantáneo para quien ya tiene la página
 * abierta; no espera ninguna revalidación de ISR (eso es solo para el
 * contenido estructural — título/fotos — no para precio/stock).
 */
export default function CatalogoPrecios() {
  useEffect(() => {
    let cancelado = false;

    supabaseBrowser()
      .rpc('catalogo_publico')
      .then(({ data, error }: { data: any; error: any }) => {
        if (cancelado || error || !data) return;

        const precios: Record<string, number> = data.precios || {};
        const sinStock: Record<string, boolean> = {};
        (data.sinStock || []).forEach((c: string) => {
          sinStock[c] = true;
        });
        const pocasUnidades: Record<string, boolean> = {};
        (data.pocasUnidades || []).forEach((c: string) => {
          pocasUnidades[c] = true;
        });

        document.querySelectorAll<HTMLElement>('[data-codigo], [data-talles-codigos]').forEach((el) => {
          const codigo = el.getAttribute('data-codigo');
          const tallesRaw = el.getAttribute('data-talles-codigos');
          const talles = tallesRaw ? tallesRaw.split(',').map((c) => ({ nombre: '', codigo: c })) : null;

          const estado = resolverEstadoProducto({ codigo, talles }, precios, sinStock, pocasUnidades);

          const tag = el.querySelector('.pricetag');
          if (tag && estado.texto) tag.textContent = estado.texto;

          if (estado.sinStock) el.setAttribute('data-agotado', '1');
          else el.removeAttribute('data-agotado');

          if (estado.pocasUnidades) el.setAttribute('data-pocas-unidades', '1');
          else el.removeAttribute('data-pocas-unidades');
        });
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
