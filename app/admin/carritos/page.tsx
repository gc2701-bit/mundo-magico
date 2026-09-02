'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { clasificarCarrito } from '@/lib/carritos-admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2, ShoppingCart } from 'lucide-react';

type ItemCarritoResumen = { tipo: string; titulo: string; variante: string | null; cantidad: number | null };
type CarritoAdmin = { user_id: string; email: string; ultimo_evento: string; completado: boolean; ultimos_items: ItemCarritoResumen[] };

/**
 * Sprint E del dashboard admin — sólo usuarios logueados (ver
 * lib/carrito-tracking.ts). "Abandonado" = sin pedido posterior, pasado
 * el umbral de lib/carritos-admin.ts (48hs) — un carrito más reciente sin
 * pedido todavía queda "en curso", no se muestra como abandonado.
 */
export default function AdminCarritosPage() {
  const [carritos, setCarritos] = useState<CarritoAdmin[] | null>(null);

  useEffect(() => {
    supabaseBrowser().rpc('carritos_admin').then(({ data }: { data: CarritoAdmin[] | null }) => {
      setCarritos(data || []);
    });
  }, []);

  const ahora = new Date().toISOString();
  const clasificados = (carritos || []).map((c) => ({
    ...c,
    estado: clasificarCarrito(c.ultimo_evento, c.completado, ahora),
  }));
  const completados = clasificados.filter((c) => c.estado === 'completado');
  const abandonados = clasificados.filter((c) => c.estado === 'abandonado');

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Carritos</h1>
      </div>

      {carritos === null ? (
        <p>Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completados</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent data-testid="carritos-completados">
                <p className="text-3xl font-bold">{completados.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Abandonados</CardTitle>
                <ShoppingCart className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent data-testid="carritos-abandonados">
                <p className="text-3xl font-bold text-destructive">{abandonados.length}</p>
              </CardContent>
            </Card>
          </div>

          <h2 className="mt-6 mb-2 text-lg font-semibold">Carritos abandonados</h2>
          {abandonados.length === 0 ? (
            <p>Ningún carrito abandonado en este momento.</p>
          ) : (
            <ul className="adm-card-items">
              {abandonados.map((c) => (
                <li key={c.user_id}>
                  <b>{c.email}</b> — hace {Math.round((Date.now() - new Date(c.ultimo_evento).getTime()) / 3600000)}hs —{' '}
                  {c.ultimos_items.map((it) => `${it.cantidad ?? ''}x ${it.titulo}`.trim()).join(', ')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
