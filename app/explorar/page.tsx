import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import { listarCatalogo } from '@/lib/busqueda';
import MundoContenido from '../components/MundoContenido';
import CatalogoPrecios from '../components/CatalogoPrecios';

/**
 * Explorar — rediseño Sprint 5 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * misma estructura que una página de mundo (filtros + grilla paginada
 * por cursor), pero "Mundo" pasa a ser un filtro más, no un segmento de
 * URL — cruza los 9 mundos. "Familia" se habilita recién al elegir un
 * mundo (no tiene sentido mezclar familias de mundos distintos).
 *
 * El buscador de texto libre que tenía esta página (ExplorarGrid.tsx,
 * filtraba client-side sobre el catálogo completo) se retira acá — iba
 * en contra del motivo por el que existe lib/busqueda.ts (Sprint 1: no
 * cargar todo el catálogo al cliente para filtrar). La búsqueda real de
 * Explorar (`/explorar?q=...`, enlazada desde el buscador predictivo del
 * nav) es Sprint 6, se conecta ahí.
 */
export const revalidate = false;

export default async function ExplorarPage() {
  const catalogo = await obtenerCatalogoPublico();

  const familiasPorMundo: Record<string, string[]> = {};
  catalogo.mundos.forEach((m) => {
    familiasPorMundo[m.slug] = Array.from(
      new Set(
        catalogo.productos
          .filter((p) => p.mundo === m.slug && p.familia)
          .map((p) => p.familia as string)
      )
    ).sort((a, b) => a.localeCompare(b, 'es'));
  });

  const primeraPagina = await listarCatalogo({ limite: 24 });

  return (
    <main>
      <MundoContenido
        mundos={catalogo.mundos}
        familiasPorMundo={familiasPorMundo}
        productosIniciales={primeraPagina.productos}
        hayMasInicial={primeraPagina.hayMas}
      />

      <CatalogoPrecios />
    </main>
  );
}
