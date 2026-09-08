'use server';

import { updateTag } from 'next/cache';
import { CATALOGO_TAG } from '@/lib/catalogo-server';

/**
 * Invalidación inmediata del catálogo público después de una escritura
 * del admin (crear/editar/activar/publicar/eliminar/lote) — bug real
 * reportado por el usuario 2026-09-08: el webhook del worker de Búho
 * (app/api/revalidate/route.ts) usa `revalidateTag(tag, 'max')`, que por
 * diseño de Next es "stale-while-revalidate" — la propia doc de Next
 * (node_modules/next/dist/docs/.../revalidateTag.md) dice que la
 * invalidación recién se dispara en la PRÓXIMA visita a una página con
 * ese tag, y esa misma visita sigue viendo lo viejo. Un admin que edita
 * y mira su propio cambio al toque podía no verlo hasta pasado un rato
 * (o hasta el próximo deploy, que reconstruye todo desde cero).
 *
 * `updateTag()` es el primitivo pensado justo para esto ("read-your-own-
 * writes", misma doc): invalida ya mismo, sin ventana de stale — pero
 * sólo se puede llamar desde un Server Action, nunca desde un Route
 * Handler ni directo desde el browser. Por eso este archivo aparte: el
 * escrito en sí sigue yendo directo del browser a Supabase (RLS de
 * siempre, sin tocar esa arquitectura) y esto se llama después, sólo
 * para la invalidación.
 *
 * A propósito NO se usa acá para el webhook del worker
 * (app/api/revalidate/route.ts): ese recibe ráfagas automáticas de
 * 16-18 llamadas en 2-3 segundos (ver catalogo_20_revalidar_debounce.sql)
 * — invalidación inmediata ahí fue justo lo que causó el incidente de
 * 404 de 2026-08-27/28 cuando una regeneración se trababa, dejando a
 * CUALQUIER visitante con la página rota. Acá es una sola persona
 * guardando un cambio puntual desde el panel: si algo fallara, lo nota
 * el propio admin al toque, nunca un cliente en silencio.
 */
export async function revalidarCatalogoAhora() {
  updateTag(CATALOGO_TAG);
}
