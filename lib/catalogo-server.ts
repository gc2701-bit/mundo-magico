import { cache } from 'react';
import type { ProductoPublico } from './catalogo-familia';

/**
 * Lectura del catálogo para páginas de servidor (ISR) — SOLO se importa
 * desde Server Components (app/[mundo]/page.tsx, etc.), nunca desde
 * componentes cliente. Pega directo al RPC catalogo_publico() (mismo RPC
 * que ya usa el sitio viejo, assets/catalogo.js) vía fetch en vez de
 * @supabase/supabase-js: así se puede pasar `next: { tags }` para que
 * revalidateTag() (Sprint 3, app/api/revalidate) invalide justo esto.
 *
 * Precio/stock/sin-stock NO viven acá — se resuelven client-side al cargar
 * la página (ver Task 2.3), igual que hoy: un cambio de precio se ve
 * instantáneo, sin esperar ninguna revalidación de ISR.
 *
 * Envuelto en `cache()` de React (Sprint 5, hallazgo real): cada página
 * de mundo llama a esta función dos veces en el mismo build —una vez
 * desde `generateStaticParams`, otra desde el propio componente— y con
 * `.next/cache` recién limpio se vio una corrida de build donde
 * Halloween/Navidad daban 404 mientras el resto de los mundos generaba
 * bien; una segunda corrida, sin tocar código, salió perfecta — carrera
 * entre workers de generación estática en paralelo escribiendo/leyendo
 * el Data Cache de Next al mismo tiempo, no un bug de lógica. `cache()`
 * dedup a nivel de request/build lo que ya debería haber sido una sola
 * llamada, en vez de confiar en que el fetch cache de Next gane la
 * carrera.
 */
const SUPABASE_URL = 'https://kyuilrlewynqrzebouww.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q-M5uG2ChZIg0c1zPfNXiQ_unIG1hZ8';

export const CATALOGO_TAG = 'catalogo';

export type Mundo = { slug: string; nombre: string; orden: number };

export type CatalogoPublico = {
  v: number;
  productos: ProductoPublico[];
  mundos: Mundo[];
};

export const obtenerCatalogoPublico = cache(async function obtenerCatalogoPublico(): Promise<CatalogoPublico> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogo_publico`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: '{}',
    next: { tags: [CATALOGO_TAG] }
  });
  if (!res.ok) {
    throw new Error('No se pudo cargar el catálogo (catalogo_publico): ' + res.status);
  }
  return res.json();
});
