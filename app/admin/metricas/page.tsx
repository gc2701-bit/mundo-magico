'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Package, Tag, PackageX, TriangleAlert, Clock } from 'lucide-react';

type Metricas = {
  publicados: number;
  sinFamilia: number;
  sinStock: number;
  pocasUnidades: number;
  esperandoActivar: number;
};

const TARJETAS: { key: keyof Metricas; label: string; icon: typeof Package; className?: string }[] = [
  { key: 'publicados', label: 'Publicados', icon: Package },
  { key: 'sinFamilia', label: 'Sin familia', icon: Tag },
  { key: 'sinStock', label: 'Sin stock', icon: PackageX, className: 'text-destructive' },
  { key: 'pocasUnidades', label: 'Pocas unidades', icon: TriangleAlert, className: 'text-amber-600' },
  { key: 'esperandoActivar', label: 'Esperando activar', icon: Clock },
];

/**
 * Sprint B del dashboard admin — conteos reales vía
 * catalogo_metricas_admin() (supabase/catalogo_21_metricas_admin.sql).
 * El gate de acceso ya lo pone app/admin/layout.tsx (Sprint A).
 */
export default function AdminMetricasPage() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    supabaseBrowser()
      .rpc('catalogo_metricas_admin')
      .then((r: { data: Metricas | null; error: unknown }) => {
        if (cancelado) return;
        if (r.error || !r.data) { setError(true); return; }
        setMetricas(r.data);
      });
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Métricas de catálogo</h1>
      </div>

      {error && <p className="adm-msg adm-msg-error">No se pudieron cargar las métricas.</p>}

      {!error && !metricas && <p>Cargando…</p>}

      {metricas && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TARJETAS.map(({ key, label, icon: Icon, className }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${className ?? ''}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${className ?? ''}`}>{metricas[key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
