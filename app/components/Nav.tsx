"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Porteo de _includes/nav.njk (Eleventy). El dropdown "Nuestros mundos" del
 * sitio viejo listaba las 7 páginas de mundo hardcodeadas — con la
 * migración a familias (ver docs/superpowers/specs/2026-08-20-nextjs-migracion-familias-design.md,
 * sección 4) ese listado pasa a ser dinámico, armado a partir de las
 * familias distintas presentes en productos publicados. Eso se implementa
 * en el Sprint 2 (Task 2.4) — acá solo queda el placeholder para no portar
 * dos veces el mismo menú.
 */
export default function Nav() {
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
        {/* TODO Sprint 2 (Task 2.4): dropdown "Nuestros mundos" dinámico por familia */}
        <Link href="/explorar">Explorar</Link>
        <Link href="/eventos">Eventos a medida</Link>
        <a href="/#visitanos">Visitanos</a>
        <a href="/#contacto">Contacto</a>
      </div>
    </nav>
  );
}
