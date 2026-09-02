'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { Package, ClipboardList, BarChart3, Users, ShoppingCart, LineChart } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Tile = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * Grid de tiles del home de /admin (Sprint A del dashboard admin) —
 * patrón adaptado de HomeLauncher de whatsapp-agent (ícono + título +
 * descripción + link), sin sus dependencias (no usa nav-items.ts ni
 * hooks de ese repo). Las 6 secciones quedan activas desde este sprint,
 * sin ningún tile "Próximamente" — Métricas/Usuarios/Carritos/Analíticas
 * apuntan a rutas que se completan en los Sprints B-F
 * (tasks/plan-dashboard-admin.md).
 */
const TILES: Tile[] = [
  { href: '/admin/catalogo', label: 'Catálogo', description: 'Publicar, editar y activar productos.', icon: Package },
  { href: '/admin/pedidos', label: 'Pedidos', description: 'Ver, armar y avisar los pedidos confirmados.', icon: ClipboardList },
  { href: '/admin/metricas', label: 'Métricas de catálogo', description: 'Publicados, sin stock, esperando activar.', icon: BarChart3 },
  { href: '/admin/usuarios', label: 'Usuarios', description: 'Administradores y clientes.', icon: Users },
  { href: '/admin/carritos', label: 'Carritos', description: 'Abandonados y completados.', icon: ShoppingCart },
  { href: '/admin/analiticas', label: 'Analíticas', description: 'Visitas y artículos más consultados.', icon: LineChart },
];

export default function AdminHomeLauncher() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold sm:text-2xl">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Elegí qué querés gestionar.</p>
      </div>

      <div data-testid="admin-home-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="block rounded-xl transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:-translate-y-0.5"
            >
              <Card className="h-full hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{tile.label}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
