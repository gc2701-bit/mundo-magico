import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CATALOGO_TAG } from '@/lib/catalogo-server';

/**
 * Recibe el Database Webhook de Supabase (Sprint 3, ver
 * docs/superpowers/specs/2026-08-20-nextjs-migracion-familias-design.md,
 * sección 2) — un cambio en catalogo_productos/catalogo_precios invalida
 * el fetch tageado 'catalogo' que usan todas las páginas de familia +
 * Explorar + el layout (ver lib/catalogo-server.ts). Server a servidor,
 * nunca desde el navegador: el secreto compartido vive sólo como variable
 * de entorno de Netlify (REVALIDATE_SECRET), nunca en este repo.
 *
 * `{ expire: 0 }` en vez de `'max'`: Next 16 cambió revalidateTag para
 * necesitar un segundo argumento — 'max' da stale-while-revalidate (el
 * visitante siguiente todavía ve la versión vieja mientras se regenera en
 * segundo plano), pero para un webhook externo que pide que el dato quede
 * al día YA, la doc de Next recomienda expirar inmediato con
 * `{ expire: 0 }` (ver node_modules/next/dist/docs/.../revalidateTag.md).
 *
 * No inspecciona el payload del webhook más allá de validar el secreto:
 * hoy hay un solo tag ('catalogo') compartido por todo el catálogo
 * público, así que cualquier cambio en las tablas relevantes revalida lo
 * mismo — no hace falta lógica por tabla/fila todavía.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag(CATALOGO_TAG, { expire: 0 });

  return NextResponse.json({ revalidated: true, tag: CATALOGO_TAG, now: Date.now() });
}
