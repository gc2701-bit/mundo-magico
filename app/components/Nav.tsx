"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Mundo } from "@/lib/catalogo-server";
import CuentaNavButton from "./cuenta/CuentaNavButton";
import CarritoNavButton from "./carrito/CarritoNavButton";

/**
 * Porteo de _includes/nav.njk (Eleventy). Restaurado a fidelidad completa
 * con el original a pedido explícito del usuario (2026-08-21) — un primer
 * pase había simplificado el link "Inicio/Historia" (siempre "Inicio") y
 * el dropdown de mundos (lista plana, sin los puntos de color ni el label
 * "Mundos" que tenía nav.njk).
 *
 * "Inicio" vs "Historia": el original lo decidía por `navVariant` en el
 * front matter de cada página Nunjucks — acá se resuelve con el pathname
 * actual, mismo criterio (en el home no tiene sentido un link a "Inicio").
 *
 * Colores del dropdown: nav.njk los tenía hardcodeados para los 6 mundos
 * de siempre. Desde Sprint 5.5 los mundos son extensibles desde el panel
 * admin — se guarda el mismo color por slug para los 6 originales, y un
 * gris neutro de respaldo para cualquier mundo nuevo que se cree después
 * (no había un color "correcto" que inventarle, y no se pidió crear uno).
 */
const COLOR_MUNDO: Record<string, string> = {
  "globos-fiesta": "#2f63cf",
  cumpleanos: "#e23b30",
  disfraces: "#a23e8c",
  reposteria: "#ec6a9c",
  decoracion: "#6f9e5b",
  combos: "#f0913a",
};
const COLOR_MUNDO_DEFAULT = "#9a938a";

export default function Nav({ mundos }: { mundos: Mundo[] }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const enHome = pathname === "/";
  const enHistoria = pathname === "/historia";

  return (
    <nav className="nav" id="nav">
      <Link className="corner-logo" href="/" aria-label="Inicio · Mundo Mágico">
        <img src="/Logo/Mundo-Magico%20Logo.jpg" alt="Logo de Mundo Mágico" width={44} height={44} />
      </Link>
      <button
        className="nav-toggle"
        type="button"
        aria-label="Abrir menú"
        aria-expanded={abierto}
        aria-controls="nav-links"
        onClick={() => setAbierto((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <div className={"nav-links" + (abierto ? " open" : "")} id="nav-links">
        {enHome ? (
          <a href="#historia">Historia</a>
        ) : enHistoria ? (
          <>
            <Link href="/">Inicio</Link>
            <Link href="/historia" aria-current="page">Historia</Link>
          </>
        ) : (
          <Link href="/">Inicio</Link>
        )}
        <div className="nav-item has-dropdown">
          <span aria-haspopup="true">Nuestros mundos</span>
          <div className="nav-dropdown" role="menu">
            <span className="nd-label">Mundos</span>
            {mundos.map((mundo) => (
              <Link key={mundo.slug} href={'/' + mundo.slug} role="menuitem">
                <span className="nd-dot" style={{ background: COLOR_MUNDO[mundo.slug] || COLOR_MUNDO_DEFAULT }} />
                {mundo.nombre}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/explorar">Explorar</Link>
        <Link href="/eventos">Eventos a medida</Link>
        <a href="/#visitanos">Visitanos</a>
        <a href="/#contacto">Contacto</a>
      </div>
      <CarritoNavButton />
      <CuentaNavButton />
    </nav>
  );
}
