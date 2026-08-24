import { notFound } from 'next/navigation';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import { listarCatalogo } from '@/lib/busqueda';
import { MUNDO_VIDEOS } from '@/lib/mundo-videos';
import Breadcrumbs from '../components/Breadcrumbs';
import MundoVideoHeader from '../components/MundoVideoHeader';
import MundoContenido from '../components/MundoContenido';
import EmptyState from '../components/EmptyState';
import CatalogoPrecios from '../components/CatalogoPrecios';

/**
 * Página de mundo — rediseño Sprint 5 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * header en video (sólo en los 5 mundos que tienen uno), filtros
 * (familia/stock) + grilla paginada por cursor vía lib/busqueda.ts, en
 * vez de la lista completa sin filtrar de antes.
 *
 * El breadcrumb (con tercer nivel `Mundo › Familia` cuando hay un
 * filtro de familia activo) y el <h1> se renderizan dentro de
 * MundoContenido, no acá — dependen de estado de cliente. En el estado
 * "sin productos" (EmptyState) MundoContenido ni se monta, por eso ese
 * branch trae su propia copia estática de breadcrumb+h1.
 *
 * Los 9 mundos, tengan o no productos publicados hoy (Halloween/Navidad
 * no tienen todavía), generan página real — antes un mundo sin
 * productos daba 404 (`notFound()` disparado por `!productos.length`),
 * lo que hubiera roto Halloween/Navidad apenas se sumaron. Ahora sólo
 * 404 si el slug no es un mundo real; sin productos muestra el
 * EmptyState de "está por venir", igual que la vidriera del home.
 */
export const revalidate = false;
export const dynamicParams = false;

export async function generateStaticParams() {
  const catalogo = await obtenerCatalogoPublico();
  return catalogo.mundos.map((m) => ({ mundo: m.slug }));
}

export default async function MundoPage({ params }: { params: Promise<{ mundo: string }> }) {
  const { mundo: mundoSlug } = await params;
  const catalogo = await obtenerCatalogoPublico();

  const mundo = catalogo.mundos.find((m) => m.slug === mundoSlug);
  if (!mundo) notFound();

  const familias = Array.from(
    new Set(
      catalogo.productos
        .filter((p) => p.mundo === mundoSlug && p.familia)
        .map((p) => p.familia as string)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const primeraPagina = await listarCatalogo({ mundo: mundoSlug, limite: 24 });
  const video = MUNDO_VIDEOS[mundoSlug];

  return (
    <main>
      {video && <MundoVideoHeader src={video} nombre={mundo.nombre} />}

      {primeraPagina.productos.length ? (
        <MundoContenido
          mundoSlug={mundoSlug}
          mundoNombre={mundo.nombre}
          familiasPorMundo={{ [mundoSlug]: familias }}
          productosIniciales={primeraPagina.productos}
          hayMasInicial={primeraPagina.hayMas}
        />
      ) : (
        <>
          <div className="wrap pt-s3">
            <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: mundo.nombre }]} />
            <h1 className="mt-s2 font-display text-fs4 text-ink">{mundo.nombre}</h1>
          </div>
          <div className="wrap py-s6">
            <EmptyState
              icono="✨"
              titulo={`${mundo.nombre} está por venir`}
              descripcion="Todavía no cargamos productos acá"
              accion={{ label: 'Ver otros mundos', href: '/explorar' }}
            />
          </div>
        </>
      )}

      <CatalogoPrecios />
    </main>
  );
}
