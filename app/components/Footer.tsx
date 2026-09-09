import Link from "next/link";
import type { Mundo } from "@/lib/catalogo-server";

/**
 * Rediseño del footer (Sprint 2, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * Opción B de la sesión de brainstorming: CTA de WhatsApp arriba de todo
 * (consulta/soporte — la compra usa "Agregar al carrito", no esto),
 * columnas simplificadas, fila legal con Términos/Privacidad y el QR de
 * ARCA.
 *
 * Color de fondo — CORREGIDO (Task B4, plan 2026-09-09 home-correccion-
 * standalone): el fondo verde (`--color-green-ink`, sumado 2026-08-24)
 * quedó revisado — la fuente de verdad correcta ahora es "Mundo Magico -
 * Home (standalone).html", y su footer usa el mismo fondo oscuro
 * `--color-nav-oscuro` (#2E2B25, rgb(46,43,37) medido) que la franja de
 * utilidad del nav (Nav.tsx, Task B2), no verde. El botón de WhatsApp se
 * invierte (fondo casi-blanco #F9F4ED medido, texto del mismo oscuro del
 * footer) para no perderse contra el fondo. Todos los textos/bordes se
 * recalcularon para AA sobre este nuevo fondo — colores medidos
 * literalmente contra el standalone (Playwright, 1440px, después de
 * desempaquetar), no reusados a ojo del verde anterior:
 *   - Links de columna (Mundos/La casa/Redes): rgb(220,211,196)=#DCD3C4,
 *     ~9.5:1 de contraste sobre #2E2B25 (calculado).
 *   - Encabezados de columna: rgb(249,244,237)=#F9F4ED (~14:1).
 *   - Términos/Privacidad + texto de pago/copyright:
 *     rgb(192,182,165)=#C0B6A5, ~7.0:1 de contraste.
 *   - Bordes (separador WA / barra inferior): rgba(255,255,255,.1), sin
 *     cambio respecto de lo que ya había.
 *
 * Pendientes de CONTENIDO, no de este sprint (ver la spec): el texto de
 * Términos y Privacidad todavía no está escrito (los links quedan
 * apuntando a rutas que se completan más adelante) y el QR de ARCA es un
 * placeholder hasta que el usuario suba el asset real del portal de ARCA.
 *
 * Mobile: acordeón nativo (<details>/<summary>, sin JS) colapsado por
 * defecto. Desktop: todo expandido en columnas — por eso hay dos bloques
 * de markup (uno `md:hidden`, otro `hidden md:grid`) en vez de un único
 * <details> forzado a estar siempre abierto en desktop, que no es
 * controlable sólo con CSS de forma limpia.
 *
 * Los `!` en las utilidades de color sobre <a>/<Link>: mismo motivo que
 * en Nav.tsx (ver ese comentario) — v2.css define `a{color:inherit}` sin
 * @layer, le gana a cualquier utilidad de Tailwind sin el modificador
 * important. Se retira cuando v2.css se retire (Sprint 9).
 */
// Texto visible acortado a "Instagram"/"Facebook"/"Yerba Buena" para
// matchear Home.dc.html línea a línea (la columna se llama "Redes", no
// "Sucursales y redes" — las sucursales viven en su propia sección de la
// página, no acá); el aria-label conserva el handle/nombre completo para
// que un lector de pantalla no pierda esa info.
const REDES = [
  { href: "https://www.instagram.com/mundo_magico_tuc/", label: "Instagram", ariaLabel: "Instagram: @mundo_magico_tuc" },
  { href: "https://www.facebook.com/mundomagicotucuman/", label: "Facebook", ariaLabel: "Facebook: Mundo Mágico Tucumán" },
  { href: "https://www.instagram.com/mundomagico.yb/", label: "Yerba Buena", ariaLabel: "Yerba Buena: @mundomagico.yb" },
];

const LA_CASA = [
  { href: "/historia", label: "Nuestra historia" },
  { href: "/eventos", label: "Eventos y mayoristas" },
  { href: "/#visitanos", label: "Sucursales y horarios" },
];

// Crema cálido para links sobre el fondo oscuro del footer — rgb(220,211,
// 196)=#DCD3C4, medido literal contra el HTML standalone (Task B4), ~9.5:1
// de contraste sobre #2E2B25 (calculado). Mejor jerarquía que blanco puro
// para texto secundario. Un solo uso, no vale la pena sumarlo como token
// global de la paleta.
const LINK_CLS = "font-body text-fs-1 text-[#DCD3C4]! hover:text-white!";

// Encabezados de columna ("Mundos"/"La casa"/"Redes") — rgb(249,244,237)=
// #F9F4ED medido, casi blanco puro pero no exactamente (Task B4).
const HEADER_CLS = "font-display text-fs0 text-[#F9F4ED]";

// Términos/Privacidad + texto de pago/copyright de la barra inferior —
// rgb(192,182,165)=#C0B6A5 medido, ~7.0:1 de contraste sobre #2E2B25
// (Task B4).
const FOOTER_MUTED_CLS = "text-[#C0B6A5]";

function ColMundos({ mundos }: { mundos: Mundo[] }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Mundos">
      <b className={HEADER_CLS}>Mundos</b>
      {mundos.map((mundo) => (
        <Link key={mundo.slug} href={"/" + mundo.slug} className={LINK_CLS}>
          {mundo.nombre}
        </Link>
      ))}
    </nav>
  );
}

function ColLaCasa() {
  return (
    <nav className="flex flex-col gap-1" aria-label="La casa">
      <b className={HEADER_CLS}>La casa</b>
      {LA_CASA.map((l) => (
        <a key={l.href} href={l.href} className={LINK_CLS}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}

function ColRedes() {
  return (
    <nav className="flex flex-col gap-1" aria-label="Redes">
      <b className={HEADER_CLS}>Redes</b>
      {REDES.map((r) => (
        <a key={r.href} href={r.href} target="_blank" rel="noopener" aria-label={r.ariaLabel} className={LINK_CLS}>
          {r.label}
        </a>
      ))}
    </nav>
  );
}

export default function Footer({ mundos }: { mundos: Mundo[] }) {
  return (
    <footer className="bg-nav-oscuro">
      {/* Padding/tamaño de fuente/radio y el ícono en SVG (en vez del
          emoji 💬 que había antes) calcados de Home.dc.html línea 547-551:
          14px/20px de padding en la barra, 10px/20px + 13px + pill
          (999px) en el botón. */}
      <div className="flex justify-center border-b border-white/10 px-[20px] py-[14px]">
        <a
          href="https://wa.me/5493813006343"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full bg-[#F9F4ED] px-[20px] py-[10px] font-body text-fs-1 font-semibold text-nav-oscuro! hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z" />
          </svg>
          ¿Necesitás ayuda? Escribinos por WhatsApp
        </a>
      </div>

      {/* Mobile — acordeón nativo, colapsado por defecto */}
      <div className="flex flex-col gap-s2 px-s3 py-s3 md:hidden">
        <details className="border-b border-white/10 pb-s2">
          <summary className={"cursor-pointer " + HEADER_CLS}>Mundos</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {mundos.map((mundo) => (
              <Link key={mundo.slug} href={"/" + mundo.slug} className={LINK_CLS}>
                {mundo.nombre}
              </Link>
            ))}
          </div>
        </details>
        <details className="border-b border-white/10 pb-s2">
          <summary className={"cursor-pointer " + HEADER_CLS}>La casa</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {LA_CASA.map((l) => (
              <a key={l.href} href={l.href} className={LINK_CLS}>
                {l.label}
              </a>
            ))}
          </div>
        </details>
        <details className="border-b border-white/10 pb-s2">
          <summary className={"cursor-pointer " + HEADER_CLS}>Redes</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {REDES.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noopener" aria-label={r.ariaLabel} className={LINK_CLS}>
                {r.label}
              </a>
            ))}
          </div>
        </details>
      </div>

      {/* Desktop — todo expandido. max-w/gap/padding calcados de
          Home.dc.html línea 553 (max-width:1280px;margin:0 auto;
          padding:24px 20px;gap:20px) — antes esto no tenía tope de ancho
          y el gap/padding eran el doble de grandes que en el diseño. */}
      <div className="mx-auto hidden max-w-[1280px] grid-cols-3 gap-[20px] px-[20px] py-s3 md:grid">
        <ColMundos mundos={mundos} />
        <ColLaCasa />
        <ColRedes />
      </div>

      {/* Barra inferior: padding/tamaño de fuente calcados de
          Home.dc.html línea 582 (14px/20px de padding, 11.5px de fuente,
          tope de 1280px). El grupo Términos/Privacidad se separa del
          texto de pago/copyright (justify-between) igual que en el
          diseño; el QR de ARCA se mantiene al lado — es un requisito
          legal real que Home.dc.html no modela, no un elemento del
          rediseño visual (ver el comentario del componente). */}
      <div className={"mx-auto flex max-w-[1280px] flex-col items-center gap-s2 border-t border-white/10 px-[20px] py-[14px] font-body text-[11.5px] md:flex-row md:flex-wrap md:justify-between " + FOOTER_MUTED_CLS}>
        <span>
          💳 Tarjetas, transferencia y efectivo · © 1994–2026 Mundo Mágico · San Miguel de Tucumán, Argentina
        </span>
        <div className="flex items-center gap-s3">
          <div className="flex items-center gap-3">
            {/* Rutas pendientes de contenido — ver el comentario de arriba */}
            <a href="/terminos" className="text-[#C0B6A5]! underline hover:text-white!">Términos</a>
            <a href="/privacidad" className="text-[#C0B6A5]! underline hover:text-white!">Privacidad</a>
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-white/30 text-center text-fs-1 text-white"
            aria-label="Código QR de ARCA (pendiente de subir)"
          >
            QR ARCA
          </div>
        </div>
      </div>
    </footer>
  );
}
