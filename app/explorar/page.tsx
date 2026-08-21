import { obtenerCatalogoPublico } from '@/lib/catalogo-server';
import ExplorarGrid from '../components/ExplorarGrid';
import CatalogoPrecios from '../components/CatalogoPrecios';

export const revalidate = false;

export default async function ExplorarPage() {
  const catalogo = await obtenerCatalogoPublico();

  return (
    <main>
      <section className="catsec">
        <ExplorarGrid productos={catalogo.productos} />
      </section>
      <CatalogoPrecios />
    </main>
  );
}
