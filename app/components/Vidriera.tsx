import Link from 'next/link';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import ProductoCard from './ProductoCard';
import EmptyState from './EmptyState';
import VidrieraFila from './VidrieraFila';

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
 * Navidad (Task 6, mismo día): en vez del EmptyState genérico de
 * arriba, usa un teaser especial sin header de ícono+"Ver todo" —
 * ícono rojo de 56px centrado, título/párrafo/CTA en columna, medido
 * literal contra `Home.dc.html` (data-screen-label="vidriera-navidad",
 * incluido su padding vertical propio de 56px vs. 52px del resto).
 *
 * Flechas prev/next (2026-09-09): la fila de productos con scroll-snap
 * vive ahora en `VidrieraFila.tsx` (client component aparte, sólo para
 * los botones + el ref del scroll) — este archivo sigue siendo un
 * server component, sin `'use client'`, sólo le pasa el `.map()` de
 * `ProductoCard` ya armado como children.
 */
export default function Vidriera({
  titulo,
  mundoSlug,
  productos,
  icono = '✨',
  bg = 'bg-background',
  accent = 'bg-green-600',
  accentText = 'text-green-600!',
  tituloColor = 'text-ink!',
}: {
  titulo: string;
  mundoSlug: string;
  productos: ProductoPublico[];
  /** Ícono del badge — desde 2026-09-09 es un componente SVG de línea
   * (ver app/components/iconos/IconoVidriera.tsx), no un emoji: el
   * usuario pidió siluetas monocromáticas en vez de emojis coloridos,
   * "que no se pierdan con el fondo" — con `stroke="currentColor"` en
   * cada ícono, heredan el `text-white` del badge automáticamente. */
  icono?: React.ReactNode;
  /** Clase Tailwind de fondo de la sección (color de marca por categoría,
   * ver el mapeo en app/page.tsx). Reemplaza el fondo crema alternado
   * de antes (`alterno`, ya no existe). */
  bg?: string;
  /** Color del `<h2>` del título — ver el comentario grande en
   * `VidrieraHeader` más abajo (fondo oscuro de Halloween necesita texto
   * claro, el resto usa el default). */
  tituloColor?: string;
  /** Clase Tailwind del acento (círculo del ícono, y — sólo en el
   * teaser de Navidad, Task 6 — el botón "Ver otros mundos").
   *
   * CORREGIDO (Task A3, plan 2026-09-09 home-correccion-standalone):
   * confirmado contra el HTML standalone que el botón "Agregar" de cada
   * card SÍ lleva este acento (rojo en Cotillón, naranja en Halloween,
   * etc.) — ya no se deja siempre verde como quedó documentado ayer (ver
   * `AgregarControl` en carrito/AccionesProducto.tsx para el mecanismo
   * de override vía `!` de Tailwind). Ver `ACCENT_BOTON_SEGURO` abajo:
   * dos acentos (Halloween/Navidad) no alcanzan 4.5:1 de contraste con
   * texto blanco tal cual están definidos en app/page.tsx (2.2:1 y
   * 4.28:1 calculados) — para el botón puntualmente se usa un tono más
   * oscuro de la misma categoría en esos dos casos, mismo criterio que
   * ya usa `accentText` frente a `accent` para el link "Ver todo". */
  accent?: string;
  /** Clase de color de texto para el link "Ver todo →", con "!" porque
   * es un <Link> (ver Global Constraints de este plan). */
  accentText?: string;
}) {
  const items = productos.filter((p) => p.mundo === mundoSlug).slice(0, 8);
  const esNavidad = mundoSlug === 'navidad';

  // Acento del botón "Agregar" (Task A3): mismo `accent` que el ícono de
  // la sección para Cumpleaños/Cotillón/Decoración, salvo Halloween y
  // Navidad, donde ese tono no llega a 4.5:1 de contraste con el texto
  // blanco del botón (2.2:1 y 4.28:1 calculados) — ahí se usa el tono
  // "ink"/oscuro de esa misma categoría, mismo criterio que ya usa
  // `accentText` frente a `accent` para el link "Ver todo".
  //
  // Los 5 valores están escritos LITERALES acá a propósito (no armados
  // con `accent + '!'` en runtime): Tailwind v4 genera CSS sólo para las
  // clases que puede ENCONTRAR COMO TEXTO en los archivos fuente que
  // escanea — un string construido en runtime nunca aparece como texto
  // en ningún archivo, así que Tailwind no genera esa clase y el botón
  // queda verde en silencio (bug real, encontrado probando en el
  // navegador — ver el comentario de `accent` en AgregarControl,
  // carrito/AccionesProducto.tsx). Los 5 valores de `accent` que existen
  // hoy están hardcodeados en el array VIDRIERAS de app/page.tsx (fuera
  // de alcance de este archivo) — si el día de mañana se suma una
  // categoría nueva con un `accent` que no está en este mapa, el botón
  // se queda verde por default (rama de abajo) en vez de fallar en
  // silencio con una clase sin CSS.
  const ACCENT_BOTON: Record<string, string> = {
    'bg-green-600': 'bg-green-600!', // Cumpleaños: ya pasa AA (~5.57:1), sin cambio de tono
    'bg-red-600': 'bg-red-600!', // Cotillón: ya pasa AA (~5.2:1), sin cambio de tono
    'bg-decoracion-accent': 'bg-decoracion-accent!', // Decoración #474238: ~10:1, sin cambio
    'bg-orange': 'bg-orange-ink!', // Halloween: accent plano da 2.2:1 → orange-ink da ~5.2:1
    'bg-red-500': 'bg-red-600!', // Navidad (por si algún día tiene productos reales): 4.28:1 → ~5.2:1
  };
  const accentBoton = ACCENT_BOTON[accent];

  return (
    <section
      className={(esNavidad ? 'py-[56px] ' : 'py-[52px] ') + bg}
      aria-labelledby={esNavidad ? undefined : `vidriera-${mundoSlug}`}
      aria-label={esNavidad ? titulo : undefined}
    >
      <div className="wrap">
        {items.length ? (
          <>
            <VidrieraHeader mundoSlug={mundoSlug} titulo={titulo} icono={icono} accent={accent} accentText={accentText} tituloColor={tituloColor} verTodo />

            <VidrieraFila>
              {items.map((p) => (
                <div key={p.id} className="w-[210px] shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <ProductoCard producto={p} accent={accentBoton} />
                </div>
              ))}
            </VidrieraFila>
          </>
        ) : esNavidad ? (
          /* Teaser especial de Navidad (Task 6) — literal contra
             `Home.dc.html` (data-screen-label="vidriera-navidad"): sin
             header de ícono+"Ver todo", ícono rojo de 56px centrado,
             título/párrafo/CTA en columna. */
          <div className="flex flex-col items-center gap-3 text-center">
            <span className={'flex h-14 w-14 items-center justify-center rounded-full text-fs2 text-white ' + accent} aria-hidden="true">
              {icono}
            </span>
            {/* text-white! (con "!"): v2.css tiene `h1,h2,h3{color:var(--ink)}`
                sin @layer (línea 81) — le gana a `text-white` sin
                important, dejando el título negro sobre el fondo verde
                (encontrado al comparar el screenshot contra
                Home.dc.html). Mismo mecanismo ya documentado en
                Nav.tsx/Footer.tsx, primera vez que aparece en un <h2>
                en vez de un <a> en este archivo. */}
            <h2 className="mt-1 font-display text-fs2 text-white! md:text-fs3">Navidad está por venir</h2>
            <p className="max-w-[46ch] font-body text-fs0 text-green-100">
              Todavía no cargamos productos acá. Volvé pronto — o mirá el resto de nuestros mundos mientras tanto.
            </p>
            <Link href="/explorar" className={'mt-2 rounded-brand px-s4 py-s2 font-body text-fs0 font-semibold text-white! ' + accent}>
              Ver otros mundos →
            </Link>
          </div>
        ) : (
          <div>
            <VidrieraHeader mundoSlug={mundoSlug} titulo={titulo} icono={icono} accent={accent} tituloColor={tituloColor} />
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
  tituloColor = 'text-ink!',
  verTodo = false,
}: {
  mundoSlug: string;
  titulo: string;
  icono: React.ReactNode;
  accent: string;
  accentText?: string;
  /** Color del `<h2>` del título de la sección (2026-09-09) — default
   * `text-ink!` (con "!", mismo motivo que abajo). Todas las categorías
   * de fondo claro andan bien con el default; Halloween (fondo casi
   * negro, `bg-ink`) necesitaba un color claro — antes se quedaba
   * siempre en `text-ink` (oscuro) hardcodeado, invisible contra su
   * propio fondo. Valor exacto para Halloween pasado desde `page.tsx`
   * (medido del standalone: `#F9F4ED`). */
  tituloColor?: string;
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
        {/* "!" en tituloColor: v2.css tiene `h1,h2,h3{color:var(--ink)}`
            sin @layer — le gana a cualquier utilidad de color de Tailwind
            sin el modificador important, mismo mecanismo ya documentado
            en el teaser de Navidad más abajo en este archivo (y en
            Nav.tsx/Footer.tsx). Sin el "!", Halloween se quedaba con el
            texto oscuro de siempre sin importar qué clase se le pasara. */}
        <h2 id={`vidriera-${mundoSlug}`} className={'font-display text-fs2 md:text-fs3 ' + tituloColor}>
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
