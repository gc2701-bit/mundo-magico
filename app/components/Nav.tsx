"use client";

import { useState } from "react";
import Link from "next/link";
import type { Mundo } from "@/lib/catalogo-server";
import CuentaNavButton from "./cuenta/CuentaNavButton";
import CarritoNavButton from "./carrito/CarritoNavButton";

/**
 * Porteo de _includes/nav.njk (Eleventy). El dropdown "Nuestros mundos" del
 * sitio viejo listaba las 7 páginas de mundo hardcodeadas — desde
 * Sprint 5.5 sigue siendo "mundo" (no familia), pero dinámico y
 * extensible desde el panel admin: `mundos` llega como prop desde
 * app/layout.tsx (Server Component, ya resolvió el catálogo una vez para
 * toda la página — Next dedupea el fetch, no se repite por componente).
 */
export default function Nav({ mundos }: { mundos: Mundo[] }) {
  const [abierto, setAbierto] = useState(false);

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
      <div className="nav-links" id="nav-links" hidden={!abierto}>
        <Link href="/">Inicio</Link>
        <div className="nav-item has-dropdown">
          <span aria-haspopup="true">Nuestros mundos</span>
          <div className="nav-dropdown" role="menu">
            {mundos.map((mundo) => (
              <Link key={mundo.slug} href={'/' + mundo.slug} role="menuitem">
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
