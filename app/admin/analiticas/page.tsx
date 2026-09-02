'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

type VisitaDia = { fecha: string; visitas: number };
type RankingItem = { ruta: string; vistas: number; titulo: string | null; mundo: string; slug: string };

const DIAS = 30;

const chartConfig = {
  visitas: { label: 'Visitas', color: 'var(--primary)' },
} satisfies ChartConfig;

/**
 * Sprint F del dashboard admin — tracking propio (lib/analytics-tracking.ts),
 * todos los visitantes. Mobile-first: el gráfico usa ResponsiveContainer
 * (vía ChartContainer de shadcn), nunca desborda el ancho de pantalla.
 */
export default function AdminAnaliticasPage() {
  const [visitas, setVisitas] = useState<VisitaDia[] | null>(null);
  const [ranking, setRanking] = useState<RankingItem[] | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.rpc('analytics_visitas_por_dia', { p_dias: DIAS }).then(({ data }: { data: VisitaDia[] | null }) => {
      setVisitas(data || []);
    });
    sb.rpc('analytics_ranking_productos', { p_dias: DIAS, p_limite: 20 }).then(({ data }: { data: RankingItem[] | null }) => {
      setRanking(data || []);
    });
  }, []);

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Analíticas</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Visitas por día (últimos {DIAS} días)</CardTitle>
        </CardHeader>
        <CardContent>
          {visitas === null ? (
            <p>Cargando…</p>
          ) : visitas.length === 0 ? (
            <p>Todavía no hay visitas registradas.</p>
          ) : (
            <ChartContainer config={chartConfig} className="max-h-64 w-full">
              <BarChart data={visitas}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="visitas" fill="var(--color-visitas)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos más consultados</CardTitle>
        </CardHeader>
        <CardContent>
          {ranking === null ? (
            <p>Cargando…</p>
          ) : ranking.length === 0 ? (
            <p>Todavía no hay vistas de producto registradas.</p>
          ) : (
            <ol className="adm-card-items">
              {ranking.map((r) => (
                <li key={r.ruta}>
                  <b>{r.vistas}</b> — {r.titulo || r.ruta}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
