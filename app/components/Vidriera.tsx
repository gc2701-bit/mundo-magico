import Link from 'next/link';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import ProductoCard from './ProductoCard';
import EmptyState from './EmptyState';

/**
 * Vidriera de un mundo en el home (Sprint 4, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * hasta 8 productos de ese mundo + "Ver todo".
 *
 * Rediseño 2026-09-08 (Task 5 de
 * docs/superpowers/plans/2026-09-08-home-pc-modernizacion-plan.md, más
 * Task 4 de la Fase mobile en el mismo día): pasa de grilla 2/4 columnas
 * sobre fondo crema alternado a una FILA horizontal con scroll-snap y
 * fondo de color propio por categoría (`bg`/`accent`/`accentText`, ver
 * el mapeo en `app/page.tsx`). El ancho de card (210px, sin variar por
 * breakpoint) es el valor literal medido en `Home.dc.html` (`flex:0 0
 * 210px`, inline style, idéntico en las 5 secciones
 * `data-screen-label="vidriera-*"`) — NO es el placeholder `200/240px`
 * que traía el plan original.
 *
 * Task 4 del plan mobile probó achicar la card a 180px en mobile (según
 * sugería ese plan si "entran 2 completas sin peek" a 200px) pero medir
 * con Playwright dio el resultado contrario: con el padding real de
 * `.wrap` (24px, `--s3`) + gap de 16px, 210px fijo ya deja un buen
 * "peek" del siguiente producto en 390px/360px/320px (~1.4-1.6 cards
 * visibles, nunca 2 completas) — achicar la card a 180px lo empeoraba
 * (subía a ~1.8 cards visibles, un peek más débil, porque una card más
 * angosta cabe más veces en el mismo ancho sobrante). Se dejó un solo
 * valor (210px) en todos los anchos: matchea el diseño literal Y da el
 * mejor peek mobile, sin necesitar un breakpoint aparte.
 *
 * `no-scrollbar`: Chrome/Safari no respetan `scrollbarWidth:'none'`
 * (sólo Firefox) — en vez de sumar una utilidad nueva a globals.css
 * (fuera del scope de archivos de esta tarea), se oculta con la
 * variante arbitraria de Tailwind `[&::-webkit-scrollbar]:hidden`
 * directo en el className, sin tocar CSS global.
 *
 * Gesto táctil (Task 4 del plan mobile): el contenedor de scroll NO
 * fija `touch-action` (Tailwind no lo setea por defecto), así que un
 * swipe diagonal puede seguir scrolleando la página verticalmente sin
 * quedar "atrapado" en el eje horizontal de la fila — verificado con
 * Playwright (touchscreen + mouse.wheel con deltaX/deltaY), ver el
 * commit de esa tarea.
 *
 * Navidad (hoy sin productos) todavía usa el EmptyState genérico de
 * abajo en este commit — el teaser especial (ícono rojo sobre fondo
 * verde, sin header) es la Task 6, que sigue en el próximo commit.
 */
export default function Vidriera({
  titulo,
  mundoSlug,
  productos,
  icono = '✨',
  bg = 'bg-background',
  accent = 'bg-green-600',
  accentText = 'text-green-600!',
}: {
  titulo: string;
  mundoSlug: string;
  productos: ProductoPublico[];
  icono?: string;
  /** Clase Tailwind de fondo de la sección (color de marca por categoría,
   * ver el mapeo en app/page.tsx). Reemplaza el fondo crema alternado
   * de antes (`alterno`, ya no existe). */
  bg?: string;
  /** Clase Tailwind del acento (círculo del ícono). El botón "Agregar"
   * de cada card NO recibe este accent: `AgregarControl`
   * (app/components/carrito/AccionesProducto.tsx) pinta `.pcard-add`
   * vía CSS legacy sin @layer, con estados propios de hover/active/
   * "is-added" que ya pelean con la cascada (ver el comentario grande
   * de Nav.tsx/Footer.tsx) — forzar un color distinto por instancia ahí
   * significaría reescribir esos tres estados por cada card en vez de
   * un simple prop pass-through, y el spec de este plan no especifica
   * ese diseño (ver README). Se deja como deviación documentada en el
   * commit en vez de adivinar. */
  accent?: string;
  /** Clase de color de texto para el link "Ver todo →", con "!" porque
   * es un <Link> (ver Global Constraints de este plan). */
  accentText?: string;
}) {
  const items = productos.filter((p) => p.mundo === mundoSlug).slice(0, 8);

  return (
    <section className={'py-[52px] ' + bg} aria-labelledby={`vidriera-${mundoSlug}`}>
      <div className="wrap">
        {items.length ? (
          <>
            <VidrieraHeader mundoSlug={mundoSlug} titulo={titulo} icono={icono} accent={accent} accentText={accentText} verTodo />

            <div
              className="flex gap-s2 overflow-x-auto pb-s1 [&::-webkit-scrollbar]:hidden"
              style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
            >
              {items.map((p) => (
                <div key={p.id} className="w-[210px] shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <ProductoCard producto={p} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div>
            <VidrieraHeader mundoSlug={mundoSlug} titulo={titulo} icono={icono} accent={accent} />
            <EmptyState
              icono={icono}
              titulo={`${titulo} está por venir`}
              descripcion="Todavía no cargamos productos acá"
              accion={{ label: 'Ver otros mundos', href: '/explorar' }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** Ícono circular + título, con "Ver todo →" opcional (sección estándar
 * con productos) — factorizado para no duplicar el mismo header entre
 * el caso "hay productos" y el EmptyState genérico de un mundo sin
 * productos. */
function VidrieraHeader({
  mundoSlug,
  titulo,
  icono,
  accent,
  accentText,
  verTodo = false,
}: {
  mundoSlug: string;
  titulo: string;
  icono: string;
  accent: string;
  accentText?: string;
  verTodo?: boolean;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-s2">
      <div className="flex items-center gap-3">
        <span
          className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fs1 text-white ' + accent}
          aria-hidden="true"
        >
          {icono}
        </span>
        <h2 id={`vidriera-${mundoSlug}`} className="font-display text-fs2 text-ink md:text-fs3">
          {titulo}
        </h2>
      </div>
      {verTodo && (
        <Link href={'/' + mundoSlug} className={'ml-auto shrink-0 font-body text-fs-1 font-semibold ' + accentText}>
          Ver todo →
        </Link>
      )}
    </div>
  );
}
