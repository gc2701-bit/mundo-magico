'use client';

import { useEffect } from 'react';
import { obtenerPreciosPublicos } from '@/lib/catalogo-precios-publico';
import { resolverEstadoProducto, resolverOferta } from '@/lib/precios-familia';

/**
 * Hidrata precio/stock client-side después de que la página (ISR) ya se
 * sirvió estática — un solo fetch a catalogo_publico() (compartido vía
 * lib/catalogo-precios-publico.ts con quien más lo necesite en la misma
 * página, ej. AgregarControl en la ficha de producto — Sprint 5),
 * aplicado a todas las tarjetas con data-codigo o data-talles-codigos.
 * Se monta una sola vez por página (ver app/[familia]/page.tsx) — nunca
 * por tarjeta, para no repetir el fetch.
 *
 * Un cambio de precio se ve instantáneo para quien ya tiene la página
 * abierta; no espera ninguna revalidación de ISR (eso es solo para el
 * contenido estructural — título/fotos — no para precio/stock).
 */
export default function CatalogoPrecios() {
  useEffect(() => {
    let cancelado = false;

    obtenerPreciosPublicos()
      .then(({ precios, sinStock, pocasUnidades }) => {
        if (cancelado) return;

        document.querySelectorAll<HTMLElement>('[data-codigo], [data-talles-codigos]').forEach((el) => {
          const codigo = el.getAttribute('data-codigo');
          const tallesRaw = el.getAttribute('data-talles-codigos');
          const variantes = tallesRaw ? tallesRaw.split(',').map((c) => ({ codigo: c, activo: true })) : null;

          const estado = resolverEstadoProducto({ codigo, variantes }, precios, sinStock, pocasUnidades);

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

          // Mensaje real de "quedan pocas unidades" arriba del botón
          // (ProductoCard.tsx) — reemplaza al ::after de v2.css, que
          // siempre caía después del botón sin poder reordenarse.
          const pocasMsg = el.querySelector<HTMLElement>('[data-pocas-unidades-msg]');
          if (pocasMsg) pocasMsg.style.display = estado.pocasUnidades ? 'block' : 'none';

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
      })
      .catch(() => {
        // Silencioso a propósito, mismo comportamiento que antes de
        // compartir el fetch: sin precios hidratados la página sigue
        // siendo usable (fotos/título ya vinieron de ISR), no hay nada
        // que mostrarle al visitante sobre un fetch de precios fallido.
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
