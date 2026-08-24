'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { resolverEstadoProducto, resolverOferta } from '@/lib/precios-familia';

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

          // Oferta: sólo aplica a productos simples (un código, no talles) —
          // ver el comentario de resolverOferta en lib/precios-familia.ts.
          const precioOfertaAttr = el.getAttribute('data-precio-oferta');
          const precioReal = codigo != null ? precios[codigo] ?? null : null;
          const oferta = precioOfertaAttr
            ? resolverOferta(precioReal, Number(precioOfertaAttr))
            : { enOferta: false, precioAntes: null, precioAhora: null, porcentajeOff: null };

          const tag = el.querySelector('.pricetag');
          if (tag) {
            tag.textContent = '';
            if (oferta.enOferta) {
              const antes = document.createElement('span');
              antes.className = 'pricetag-antes';
              antes.textContent = oferta.precioAntes || '';
              const ahora = document.createElement('span');
              ahora.className = 'pricetag-ahora';
              ahora.textContent = oferta.precioAhora || '';
              tag.append(antes, ahora);
            } else if (estado.texto) {
              tag.textContent = estado.texto;
            }
          }

          if (estado.sinStock) el.setAttribute('data-agotado', '1');
          else el.removeAttribute('data-agotado');

          if (estado.pocasUnidades) el.setAttribute('data-pocas-unidades', '1');
          else el.removeAttribute('data-pocas-unidades');

          // Badge — prioridad sin stock > oferta > nuevo (nuevo ya viene
          // server-rendered en ProductoCard.tsx si corresponde).
          const badge = el.querySelector<HTMLElement>('[data-badge]');
          if (badge) {
            if (estado.sinStock) {
              badge.textContent = 'Sin stock';
              badge.style.background = 'var(--color-muted)';
              badge.style.display = 'inline-block';
            } else if (oferta.enOferta) {
              badge.textContent = `-${oferta.porcentajeOff}%`;
              badge.style.background = 'var(--color-red-ink)';
              badge.style.display = 'inline-block';
            } else if (badge.dataset.badgeTipo !== 'nuevo') {
              badge.style.display = 'none';
            }
          }
        });
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
