'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { registrarVisita } from '@/lib/analytics-tracking';
import { useCuenta } from './cuenta/CuentaProvider';

/**
 * Sprint F del dashboard admin — montado una sola vez en app/layout.tsx.
 * Detecta ficha de producto por la FORMA de la ruta (2 segmentos, la
 * misma que [mundo]/[slug]) en vez de instrumentar cada página a mano.
 * /admin/* queda afuera a propósito: no tiene sentido medir la
 * navegación del propio staff como "visita" del sitio.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const { sb, sesion } = useCuenta();
  const userId = sesion?.user?.id ?? null;

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    const segmentos = pathname.split('/').filter(Boolean);
    registrarVisita(sb, pathname, { producto: segmentos.length === 2, userId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userId]);

  return null;
}
