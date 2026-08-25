'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { obtenerComposicionCombo, type ItemComboComposicion } from '@/lib/combo-composicion';

/**
 * "Este combo incluye: 2× SOMBRERO, 1× ANTIFAZ" en la ficha de producto
 * (Sprint 6 del plan de catálogo admin, SPEC-catalogo-admin-variantes.md
 * sección 6) — combo_composicion() (lib/combo-composicion.ts) ya filtra
 * sola por "combo publicado", así que acá alcanza con no renderizar nada
 * si no hay filas: cubre tanto "no es un combo" como "todavía no
 * sincronizó" sin necesidad de distinguirlos ni de mostrarle a un
 * visitante un mensaje de estado de sync (eso sólo tiene sentido en el
 * panel admin, ver ProductoEditModal.tsx).
 */
export default function ComboComposicion({ codigo }: { codigo: string | null }) {
  const [items, setItems] = useState<ItemComboComposicion[]>([]);

  useEffect(() => {
    if (!codigo) {
      setItems([]);
      return;
    }
    let cancelado = false;
    obtenerComposicionCombo(supabaseBrowser(), codigo).then((filas) => {
      if (!cancelado) setItems(filas);
    });
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-fs0 font-semibold text-ink">Este combo incluye:</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((it, i) => (
          <li key={i} className="font-body text-fs-1 text-muted">{it.cantidad}× {it.nombre}</li>
        ))}
      </ul>
    </div>
  );
}
