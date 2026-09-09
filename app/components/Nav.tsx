"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Mundo } from "@/lib/catalogo-server";
import { COLOR_MUNDO, COLOR_MUNDO_DEFAULT } from "@/lib/catalogo-mundo";
import CuentaNavButton from "./cuenta/CuentaNavButton";
import CarritoNavButton from "./carrito/CarritoNavButton";
import BuscadorPredictivo from "./BuscadorPredictivo";

/**
 * Rediseño del nav (Sprint 2, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * reemplaza el porteo 1:1 de _includes/nav.njk por la estructura acordada
 * con el usuario en la sesión de brainstorming del 2026-08-24: desktop en
 * dos niveles (franja de utilidad + fila principal con mega-menú de
 * Mundos en grilla), mobile con barra inferior fija estilo app.
 *
 * CarritoNavButton/CuentaNavButton NO se tocan (siguen con su estilo
 * v2.css, `.cart-nav`/`.cuenta-nav` — su rediseño visual es de otro
 * sprint) — acá sólo cambia el chrome que los rodea.
 *
 * Los links secundarios que nav.njk tenía en la fila única (Historia,
 * Eventos a medida, Visitanos, Contacto) se mudan a la franja de utilidad
 * en desktop, y a un bloque debajo de la grilla de mundos en el panel de
 * mobile — no entraban en la fila principal de 5 slots sin romper la
 * jerarquía ya aprobada. El link "Inicio" se retira: el logo ya cumple
 * esa función (convención estándar), no hace falta un link de texto
 * aparte como tenía nav.njk.
 *
 * Búsqueda predictiva (Sprint 6): el botón "Buscar" abre/cierra
 * BuscadorPredictivo.tsx (dropdown en desktop, pantalla completa en
 * mobile) — Nav.tsx sólo maneja el estado abierto/cerrado, la lógica de
 * búsqueda vive toda en ese componente.
 *
 * IMPORTANTE - por que hay "!" en algunas utilidades de color sobre <a>:
 * v2.css define a{color:inherit} sin capa (@layer) - Tailwind v4 mete
 * TODAS sus utilidades dentro de @layer utilities, y una regla sin capa
 * le gana a cualquier regla con capa sin importar la especificidad. Sin
 * el modificador "!" (important), cualquier text-* puesto directo sobre
 * un <a>/<Link> se ve pisado en silencio por ese color:inherit.
 * Confirmado con el CSS compilado y el test de contraste de
 * tests/e2e-next/nav.spec.js. Se resuelve solo cuando v2.css se retire
 * (Sprint 9) - hasta entonces, todo <a> con color propio en componentes
 * nuevos necesita "!".
 */
const LINKS_UTILIDAD = [
  { href: "/historia", label: "Historia" },
  { href: "/eventos", label: "Eventos a medida" },
  { href: "/#visitanos", label: "Visitanos" },
  { href: "/#contacto", label: "Contacto" },
];

/* Íconos de línea SVG inline — mismo patrón que CuentaNavButton/
 * CarritoNavButton (viewBox 24x24, stroke=currentColor, strokeWidth 1.9,
 * cabos/uniones redondeados): reemplazan los emojis 🎉/🔍/🏠 (Task B2,
 * plan 2026-09-09 home-correccion-standalone). */
function IconLupa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconMundos({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5a1 1 0 0 0 1 1H9.5v-6h5v6H17.5a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function MenuMundos({ mundos, onNavegar }: { mundos: Mundo[]; onNavegar: () => void }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-s2">
        {mundos.map((mundo) => (
          <Link
            key={mundo.slug}
            href={"/" + mundo.slug}
            role="menuitem"
            onClick={onNavegar}
            className="flex flex-col items-center gap-1 rounded-brand p-s2 text-center hover:bg-green-soft"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: COLOR_MUNDO[mundo.slug] || COLOR_MUNDO_DEFAULT }}
              aria-hidden="true"
            />
            <span className="font-body text-fs-1 text-ink">{mundo.nombre}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/explorar"
        role="menuitem"
        onClick={onNavegar}
        className="mt-s2 block text-center font-body text-fs-1 text-green-ink!"
      >
        Ver todo el catálogo →
      </Link>
    </>
  );
}

export default function Nav({ mundos }: { mundos: Mundo[] }) {
  const [mundosDesktopAbierto, setMundosDesktopAbierto] = useState(false);
  const [mundosMobileAbierto, setMundosMobileAbierto] = useState(false);
  const [buscarDesktopAbierto, setBuscarDesktopAbierto] = useState(false);
  const [buscarMobileAbierto, setBuscarMobileAbierto] = useState(false);
  const pathname = usePathname();
  const mundosWrapRef = useRef<HTMLDivElement | null>(null);
  const [conScroll, setConScroll] = useState(false);

  useEffect(() => {
    if (!mundosDesktopAbierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMundosDesktopAbierto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mundosDesktopAbierto]);

  // Nav sticky + shrink al scrollear (Task 2, plan de modernización PC
  // 2026-09-08) — sólo aplica al bloque desktop de abajo, el bloque
  // mobile (logo arriba + barra inferior) no se toca.
  useEffect(() => {
    function onScroll() {
      setConScroll(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Desktop — sticky, se achica al scrollear (Task 2, plan de
          modernización PC 2026-09-08). backdrop-blur + sombra sólo con
          scroll para no competir visualmente con el hero cuando está
          arriba de todo. Franja de utilidad + fila principal comparten
          este wrapper sticky para que se peguen arriba como una sola
          unidad visual. */}
      <div
        className={
          "sticky top-0 z-30 hidden md:block bg-[var(--color-background-hero)]/90 backdrop-blur-sm transition-shadow duration-[250ms] " +
          (conScroll ? "shadow-md" : "")
        }
      >
        {/* Desktop — franja de utilidad. Fondo oscuro (#2E2B25, Task B2,
            plan 2026-09-09 home-correccion-standalone) medido contra "Mundo
            Magico - Home (standalone).html" — mismo tono que el footer
            (Task B4), token compartido `--color-nav-oscuro`. Blanco/70%
            sobre ese fondo da ~7.7:1 de contraste (calculado), sobra AA. */}
        <div className="flex justify-center gap-s4 bg-nav-oscuro py-1 font-body text-fs-1 text-white/70">
          {LINKS_UTILIDAD.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className="hover:text-white!"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop — fila principal. Los 4 controles (Mundos/Buscar/Cuenta/
            Carrito) van juntos a la derecha, a pedido explícito del
            usuario (2026-08-24) — el primer intento los separaba (Mundos a
            la izquierda, buscador centrado). */}
        <nav
          className={
            "flex items-center justify-between gap-s3 border-b border-line px-s3 transition-[padding] duration-[250ms] " +
            (conScroll ? "py-1" : "py-2")
          }
          id="nav-desktop"
          aria-label="Navegación principal"
        >
          <Link href="/" aria-label="Inicio · Mundo Mágico" className="flex shrink-0 items-center gap-s2">
            <img
              src="/Logo/mundo-magico-icono.webp"
              alt="Logo de Mundo Mágico"
              width={44}
              height={44}
              className={
                "rounded-full transition-[width,height] duration-[250ms] " +
                (conScroll ? "h-9 w-9" : "h-11 w-11")
              }
            />
            {/* Wordmark del nav (2026-09-09) — color/tamaño medidos directo
                del HTML standalone (span "Mundo Mágico", 20px, rgb(30,136,52)
                = #1E8834, que ya es el token --color-green existente, no
                hace falta uno nuevo). Mismo <Link> que el logo: clickear el
                texto también lleva al home. */}
            <span className="font-display text-[20px] font-semibold text-green!">Mundo Mágico</span>
          </Link>

          <div className="flex items-center gap-s4">
            <div
              ref={mundosWrapRef}
              className="relative"
              onMouseEnter={() => setMundosDesktopAbierto(true)}
              onMouseLeave={() => setMundosDesktopAbierto(false)}
            >
              <button
                type="button"
                className="flex items-center gap-1 font-body text-fs0 text-ink"
                aria-haspopup="true"
                aria-expanded={mundosDesktopAbierto}
                aria-controls="mundos-menu-desktop"
                onFocus={() => setMundosDesktopAbierto(true)}
                onClick={() => setMundosDesktopAbierto((v) => !v)}
              >
                Mundos <IconChevronDown className="h-3.5 w-3.5" />
              </button>
              {mundosDesktopAbierto && (
                <div
                  id="mundos-menu-desktop"
                  role="menu"
                  aria-label="Nuestros mundos"
                  className="absolute right-0 top-full z-20 w-72 rounded-brand border border-line bg-surface p-s3 shadow-lg"
                >
                  <MenuMundos mundos={mundos} onNavegar={() => setMundosDesktopAbierto(false)} />
                </div>
              )}
            </div>

            {buscarDesktopAbierto ? (
              <BuscadorPredictivo variante="desktop" onCerrar={() => setBuscarDesktopAbierto(false)} />
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 font-body text-fs0 text-muted"
                onClick={() => setBuscarDesktopAbierto(true)}
              >
                <IconLupa className="h-4 w-4" /> Buscar
              </button>
            )}

            <CuentaNavButton />
            <CarritoNavButton />
          </div>
        </nav>
      </div>

      {/* Mobile — logo + wordmark arriba, todo lo demás en la barra inferior */}
      <div className="flex items-center justify-center border-b border-line bg-[var(--color-background-hero)] py-2 md:hidden">
        <Link href="/" aria-label="Inicio · Mundo Mágico" className="flex items-center gap-2">
          <img src="/Logo/mundo-magico-icono.webp" alt="Logo de Mundo Mágico" width={36} height={36} className="rounded-full" />
          <span className="font-display text-[18px] font-semibold text-green!">Mundo Mágico</span>
        </Link>
      </div>

      {mundosMobileAbierto && (
        <div
          className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-background p-s3 md:hidden"
          role="dialog"
          aria-label="Nuestros mundos"
        >
          <button
            type="button"
            className="self-end font-body text-fs0 text-ink"
            aria-label="Cerrar"
            onClick={() => setMundosMobileAbierto(false)}
          >
            ✕
          </button>
          <div className="mt-s2">
            <MenuMundos mundos={mundos} onNavegar={() => setMundosMobileAbierto(false)} />
          </div>
          <div className="mt-s4 flex flex-col gap-s2 border-t border-line pt-s3">
            {LINKS_UTILIDAD.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMundosMobileAbierto(false)}
                className="font-body text-fs-1 text-muted!"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {buscarMobileAbierto && (
        <div className="fixed inset-0 z-30 flex flex-col bg-background p-s3 md:hidden" role="dialog" aria-label="Buscar">
          <BuscadorPredictivo variante="mobile" onCerrar={() => setBuscarMobileAbierto(false)} />
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-background py-1 md:hidden"
        aria-label="Navegación principal"
        id="nav-mobile-bottom"
      >
        <Link
          href="/"
          className={
            "flex flex-col items-center gap-0.5 py-1 font-body text-fs-1 " +
            (pathname === "/" ? "text-green-ink!" : "text-muted!")
          }
        >
          <IconHome className="h-[22px] w-[22px]" />
          Home
        </Link>
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 py-1 font-body text-fs-1 text-muted"
          aria-haspopup="true"
          aria-expanded={mundosMobileAbierto}
          onClick={() => setMundosMobileAbierto(true)}
        >
          <IconMundos className="h-[22px] w-[22px]" />
          Mundos
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 py-1 font-body text-fs-1 text-muted"
          onClick={() => setBuscarMobileAbierto(true)}
        >
          <IconLupa className="h-[22px] w-[22px]" />
          Buscar
        </button>
        <div className="flex flex-col items-center justify-center">
          <CuentaNavButton />
        </div>
        <div className="flex flex-col items-center justify-center">
          <CarritoNavButton />
        </div>
      </nav>
    </>
  );
}
