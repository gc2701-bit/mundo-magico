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
 * `'max'` (incidente de producción 2026-08-28): este archivo usaba
 * `{ expire: 0 }`, leyendo mal la doc de Next — esa forma NO es "expirar
 * ya, pero seguir sirviendo la versión vieja mientras se regenera atrás".
 * `node_modules/next/dist/docs/.../revalidateTag.md` dice literal que
 * `{ expire: 0 }` hace que **la próxima request sea un "blocking
 * revalidate/cache miss"** — sin red de contención — y recomienda `'max'`
 * (stale-while-revalidate real) para todos los casos salvo necesitar la
 * expiración inmediata de verdad. Con `{ expire: 0 }`, el primer visitante
 * después de cada llamada de este webhook pagaba una regeneración
 * bloqueante de `/[mundo]` y `/[mundo]/[slug]` (páginas `revalidate:
 * false`, sin autocorrección por tiempo); una sola vez que esa
 * regeneración tropezó, quedó cacheado un 404 permanente en
 * mundomagico.ar, reproducido en vivo con una única llamada limpia (sin
 * ráfaga) a este endpoint. `'max'` deja al visitante viendo la versión
 * anterior (buena) mientras se regenera en segundo plano — ningún
 * visitante paga ni arriesga una regeneración bloqueante.
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

  revalidateTag(CATALOGO_TAG, 'max');

  return NextResponse.json({ revalidated: true, tag: CATALOGO_TAG, now: Date.now() });
}
