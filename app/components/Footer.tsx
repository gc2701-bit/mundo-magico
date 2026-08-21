import Link from "next/link";
import type { Mundo } from "@/lib/catalogo-server";

/**
 * Porteo de _includes/footer.njk (Eleventy). La columna "Mundos" del
 * footer viejo listaba las 7 páginas de mundo hardcodeadas — igual que en
 * Nav.tsx, `mundos` llega como prop desde app/layout.tsx (dinámico y
 * extensible desde Sprint 5.5, ya no una lista fija). El resto (marca,
 * contacto, redes) no depende de la categorización y se portó tal cual.
 */
export default function Footer({ mundos }: { mundos: Mundo[] }) {
  return (
    <footer className="site-footer">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <div className="fname">Mundo Mágico ✨</div>
          <p>El cotillón de Tucumán desde 1994. La misma familia, el mismo mostrador, la misma alegría.</p>
        </div>
        <nav className="foot-col" aria-label="Mundos">
          <b>Mundos</b>
          {mundos.map((mundo) => (
            <Link key={mundo.slug} href={'/' + mundo.slug}>
              {mundo.nombre}
            </Link>
          ))}
        </nav>
        <nav className="foot-col" aria-label="La casa">
          <b>La casa</b>
          <a href="/historia">Nuestra historia</a>
          <a href="/eventos">Eventos y mayoristas 💍</a>
          <a href="/#visitanos">Sucursales y horarios</a>
        </nav>
        <nav className="foot-col" aria-label="Hablemos">
          <b>Hablemos</b>
          <a href="https://wa.me/5493813006343" target="_blank" rel="noopener">
            WhatsApp: +54 9 381 300-6343
          </a>
          <a href="https://www.instagram.com/mundo_magico_tuc/" target="_blank" rel="noopener">
            Instagram: @mundo_magico_tuc
          </a>
          <a href="https://www.facebook.com/mundomagicotucuman/" target="_blank" rel="noopener">
            Facebook: Mundo Mágico Tucumán
          </a>
          <a href="https://www.instagram.com/mundomagico.yb/" target="_blank" rel="noopener">
            Yerba Buena: @mundomagico.yb
          </a>
        </nav>
      </div>
      <div className="wrap foot-bottom">
        <span>© 1994–2026 Mundo Mágico · San Miguel de Tucumán, Argentina</span>
        <span>Hecho con ❤️ y mucho cotillón</span>
      </div>
    </footer>
  );
}
