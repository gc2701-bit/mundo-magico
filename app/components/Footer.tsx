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
const REDES = [
  { href: "https://www.instagram.com/mundo_magico_tuc/", label: "Instagram: @mundo_magico_tuc" },
  { href: "https://www.facebook.com/mundomagicotucuman/", label: "Facebook: Mundo Mágico Tucumán" },
  { href: "https://www.instagram.com/mundomagico.yb/", label: "Yerba Buena: @mundomagico.yb" },
];

const LA_CASA = [
  { href: "/historia", label: "Nuestra historia" },
  { href: "/eventos", label: "Eventos y mayoristas 💍" },
  { href: "/#visitanos", label: "Sucursales y horarios" },
];

function ColMundos({ mundos }: { mundos: Mundo[] }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Mundos">
      <b className="font-display text-fs0 text-ink">Mundos</b>
      {mundos.map((mundo) => (
        <Link key={mundo.slug} href={"/" + mundo.slug} className="font-body text-fs-1 text-muted! hover:text-ink!">
          {mundo.nombre}
        </Link>
      ))}
    </nav>
  );
}

function ColLaCasa() {
  return (
    <nav className="flex flex-col gap-1" aria-label="La casa">
      <b className="font-display text-fs0 text-ink">La casa</b>
      {LA_CASA.map((l) => (
        <a key={l.href} href={l.href} className="font-body text-fs-1 text-muted! hover:text-ink!">
          {l.label}
        </a>
      ))}
    </nav>
  );
}

function ColSucursalesRedes() {
  return (
    <nav className="flex flex-col gap-1" aria-label="Sucursales y redes">
      <b className="font-display text-fs0 text-ink">Sucursales y redes</b>
      {REDES.map((r) => (
        <a key={r.href} href={r.href} target="_blank" rel="noopener" className="font-body text-fs-1 text-muted! hover:text-ink!">
          {r.label}
        </a>
      ))}
    </nav>
  );
}

export default function Footer({ mundos }: { mundos: Mundo[] }) {
  return (
    <footer className="border-t border-line bg-background">
      <div className="flex justify-center border-b border-line py-s3">
        <a
          href="https://wa.me/5493813006343"
          target="_blank"
          rel="noopener"
          className="rounded-brand bg-green px-s4 py-s2 font-body text-fs0 font-semibold text-white! hover:bg-green-ink"
        >
          💬 ¿Necesitás ayuda? Escribinos por WhatsApp
        </a>
      </div>

      {/* Mobile — acordeón nativo, colapsado por defecto */}
      <div className="flex flex-col gap-s2 px-s3 py-s3 md:hidden">
        <details className="border-b border-line pb-s2">
          <summary className="cursor-pointer font-display text-fs0 text-ink">Mundos</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {mundos.map((mundo) => (
              <Link key={mundo.slug} href={"/" + mundo.slug} className="font-body text-fs-1 text-muted!">
                {mundo.nombre}
              </Link>
            ))}
          </div>
        </details>
        <details className="border-b border-line pb-s2">
          <summary className="cursor-pointer font-display text-fs0 text-ink">La casa</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {LA_CASA.map((l) => (
              <a key={l.href} href={l.href} className="font-body text-fs-1 text-muted!">
                {l.label}
              </a>
            ))}
          </div>
        </details>
        <details className="border-b border-line pb-s2">
          <summary className="cursor-pointer font-display text-fs0 text-ink">Sucursales y redes</summary>
          <div className="mt-s2 flex flex-col gap-1">
            {REDES.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noopener" className="font-body text-fs-1 text-muted!">
                {r.label}
              </a>
            ))}
          </div>
        </details>
      </div>

      {/* Desktop — todo expandido */}
      <div className="hidden grid-cols-3 gap-s5 px-s3 py-s5 md:grid">
        <ColMundos mundos={mundos} />
        <ColLaCasa />
        <ColSucursalesRedes />
      </div>

      <div className="flex flex-col items-center gap-s2 border-t border-line px-s3 py-s3 font-body text-fs-1 text-muted md:flex-row md:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-s2">
          <span>💳 Tarjetas, transferencia y efectivo</span>
          <span aria-hidden="true">·</span>
          <span>© 1994–2026 Mundo Mágico · San Miguel de Tucumán, Argentina</span>
          <span aria-hidden="true">·</span>
          {/* Rutas pendientes de contenido — ver el comentario de arriba */}
          <a href="/terminos" className="underline">Términos y condiciones</a>
          <a href="/privacidad" className="underline">Privacidad</a>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-line text-center text-fs-1"
          aria-label="Código QR de ARCA (pendiente de subir)"
        >
          QR ARCA
        </div>
      </div>
    </footer>
  );
}
