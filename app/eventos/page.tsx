/**
 * Puerto de eventos-v2.html (sitio Eleventy viejo) — eventos a medida
 * (casamientos, 15 años, etc.) y venta mayorista. No estaba migrada,
 * encontrada en el inventario de páginas del sitio viejo tras el
 * incidente de producción del home (2026-08-21, ver "Corte a
 * producción" en el plan). Mismo contenido — se omiten las animaciones
 * de entrada "reveal" (scroll-in), mismo criterio ya usado en el home.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventos, casamientos y venta mayorista · Mundo Mágico Tucumán',
  description:
    '¿Casamiento, 15 años, cumpleaños grande o compra por cantidad? Te armamos todo el cotillón y la decoración. +30 años de experiencia y lista mayorista para revendedores en Tucumán.',
};

const WA = 'https://wa.me/5493813006343?text=';

const SERVICIOS = [
  {
    titulo: 'Casamientos',
    desc: 'Decoración de mesas, cartelería, cotillón para la fiesta y detalles para los invitados.',
    cta: 'Pedir asesoramiento',
    msg: '¡Hola Mundo Mágico! Estoy organizando un casamiento y quiero que me asesoren con el cotillón y la decoración.',
    icon: <><circle cx="9" cy="14" r="5" /><circle cx="15" cy="10" r="5" /></>,
  },
  {
    titulo: '15 años',
    desc: 'Números gigantes, backdrop, globos, souvenirs y todo para la mesa dulce.',
    cta: 'Pedir asesoramiento',
    msg: '¡Hola Mundo Mágico! Estoy organizando un cumpleaños de 15 y quiero que me armen todo.',
    icon: <><path d="M4 9l3.5 3L12 5l4.5 7L20 9l-1.8 9H5.8z" /><path d="M5.5 21h13" /></>,
  },
  {
    titulo: 'Cumpleaños grandes y aniversarios',
    desc: 'El festejo de los grandes: cumpleaños redondos, bodas de plata y reuniones importantes.',
    cta: 'Pedir asesoramiento',
    msg: '¡Hola Mundo Mágico! Estoy organizando un cumpleaños grande / aniversario y quiero asesoramiento.',
    icon: <><path d="M5 12h14v8H5zM5 15.5c1.2.9 2.3-.9 3.5 0s2.3.9 3.5 0 2.3-.9 3.5 0 2.3.9 3.5 0M12 8.5V12M12 4.2c-.8.9-.8 2 0 2.6.8-.6.8-1.7 0-2.6z" /></>,
  },
  {
    titulo: 'Eventos y empresas',
    desc: 'Fin de año, egresados, lanzamientos y festejos de empresa. Cotización a medida.',
    cta: 'Pedir cotización',
    msg: '¡Hola Mundo Mágico! Estoy organizando un evento y quiero una cotización para empresa.',
    icon: <><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V9h4a1 1 0 0 1 1 1v11M7 8h2M7 12h2M7 16h2" /></>,
  },
];

const PASOS = [
  { n: 1, titulo: 'Contanos tu idea', desc: 'La fecha, cuántos invitados y el estilo que imaginás.', icon: <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 4V6z" /> },
  { n: 2, titulo: 'Armamos tu lista', desc: 'Te pasamos todo con precio y presupuesto sin cargo.', icon: <path d="M4 5h.01M4 12h.01M4 19h.01M8 5h12M8 12h12M8 19h12" /> },
  { n: 3, titulo: 'Retirás y celebrás', desc: 'Pasás por el local, lo llevás y a festejar.', icon: <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M3 8h18v4H3zM12 8v13M12 8s-1.5-4.5-4.5-4.5a2.25 2.25 0 0 0 0 4.5H12zM12 8s1.5-4.5 4.5-4.5a2.25 2.25 0 0 1 0 4.5H12z" /> },
];

const VALORES = [
  { titulo: 'Descuento por cantidad', desc: 'Cuanto más llevás, mejor el precio. Ideal para reventa y grandes fiestas.', icon: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12V4h8a2 2 0 0 1 1.4.6l8.2 8.2a1 1 0 0 1 0 1.6z" /><circle cx="7.5" cy="7.5" r="1.3" /></> },
  { titulo: '+30 años de stock', desc: 'Más de 1.000 productos y variedad para surtir tu negocio todo el año.', icon: <path d="M4 9l1.5-5h13L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 20v-6h6v6" /> },
  { titulo: 'Reposición para tu negocio', desc: 'Te avisamos cuando llega mercadería nueva y te guardamos lo tuyo.', icon: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></> },
  { titulo: 'Atención directa', desc: 'Trato personal por WhatsApp, sin intermediarios ni vueltas.', icon: <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 4V6z" /> },
];

const OTROS_MUNDOS = [
  { nombre: 'Cotillón', href: '/globos-fiesta', icon: <><path d="M12 2.5c3 0 5.5 2.7 5.5 6S14.8 15 12 15s-5.5-3.2-5.5-6.5 2.5-6 5.5-6z" /><path d="M12 15l-1 2.5h2L12 21.5" /></> },
  { nombre: 'Cumpleaños', href: '/cumpleanos', icon: <path d="M5 12h14v8H5zM5 15.5c1.2.9 2.3-.9 3.5 0s2.3.9 3.5 0 2.3-.9 3.5 0 2.3.9 3.5 0M12 8.5V12M12 4.2c-.8.9-.8 2 0 2.6.8-.6.8-1.7 0-2.6z" /> },
  { nombre: 'Repostería', href: '/reposteria', icon: <path d="M6.5 10a5.5 5.5 0 0 1 11 0M5 10h14l-1.8 10H6.8zM9 14l.6 3M15 14l-.6 3" /> },
  { nombre: 'Decoración', href: '/decoracion', icon: <path d="M4 11l8-7 8 7M6.5 9.3V20h11V9.3M10 20v-5h4v5" /> },
  { nombre: 'Disfraces y accesorios', href: '/disfraces', icon: <><path d="M4 5.5c2.6 1 5.4 1 8 0 2.6 1 5.4 1 8 0V11c0 5.2-3.6 9.5-8 9.5S4 16.2 4 11V5.5zM8.5 10.5h.01M15.5 10.5h.01M9 15c1 .9 2 1.4 3 1.4s2-.5 3-1.4" /></> },
  { nombre: 'Combos', href: '/explorar', icon: <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M3 8h18v4H3zM12 8v13M12 8s-1.5-4.5-4.5-4.5a2.25 2.25 0 0 0 0 4.5H12zM12 8s1.5-4.5 4.5-4.5a2.25 2.25 0 0 1 0 4.5H12z" /> },
];

export default function EventosPage() {
  return (
    <>
      <link rel="stylesheet" href="/assets/eventos.css" />
      <a className="skip-link" href="#tu-evento">Saltar al contenido</a>

      <header className="evt-hero" id="inicio">
        <div className="hero-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        </div>
        <div className="eyebrow">Eventos a medida</div>
        <h1>Para cuando la ocasión es <em>a lo grande</em></h1>
        <p className="lead">
          Casamientos, 15 años, cumpleaños grandes o compras por cantidad. Traé la fecha y la idea: nosotros armamos
          la lista completa para que no te falte nada.
        </p>
        <div className="season-pill">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
          Presupuesto sin cargo · Te asesoramos
        </div>
        <a className="cue" href="#tu-evento" aria-label="Ver los servicios">
          Empecemos
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </a>
      </header>

      <main>
        <section className="svc" id="tu-evento">
          <div className="wrap">
            <div className="svc-head">
              <span className="kicker">Fiestas &amp; celebraciones</span>
              <h2>Para tu gran evento</h2>
              <p>Un evento grande no se improvisa. Elegí de qué se trata y te armamos todo el cotillón y la decoración, de principio a fin.</p>
            </div>

            <div className="evt-grid">
              {SERVICIOS.map((s) => (
                <a key={s.titulo} className="evt-card" href={WA + encodeURIComponent(s.msg)} target="_blank" rel="noopener">
                  <span className="evt-ic"><svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg></span>
                  <b>{s.titulo}</b>
                  <small>{s.desc}</small>
                  <span className="evt-go">
                    {s.cta}
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </a>
              ))}
            </div>

            <div className="process">
              {PASOS.map((p) => (
                <div className="step" key={p.n}>
                  <span className="step-num" aria-hidden="true">{p.n}</span>
                  <span className="step-ic" aria-hidden="true"><svg viewBox="0 0 24 24">{p.icon}</svg></span>
                  <b>{p.titulo}</b>
                  <small>{p.desc}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="svc" id="mayorista">
          <div className="wrap">
            <div className="mayor-panel">
              <div className="svc-head">
                <span className="kicker">Mayorista &amp; cantidad</span>
                <h2>Comprás por cantidad o sos mayorista</h2>
                <p>¿Revendés, tenés un kiosco, organizás muchas fiestas o necesitás comprar en volumen? Te damos precio por cantidad y te ayudamos con la reposición.</p>
              </div>
              <div>
                <div className="vals">
                  {VALORES.map((v) => (
                    <div className="val" key={v.titulo}>
                      <span className="vic"><svg viewBox="0 0 24 24" aria-hidden="true">{v.icon}</svg></span>
                      <span><b>{v.titulo}</b><small>{v.desc}</small></span>
                    </div>
                  ))}
                </div>
                <div className="mayor-cta">
                  <a
                    className="btn btn-primary"
                    href={WA + encodeURIComponent('¡Hola Mundo Mágico! Soy revendedor/a y quiero la lista mayorista.')}
                    target="_blank"
                    rel="noopener"
                  >
                    Pedí la lista mayorista →
                  </a>
                  <a
                    className="btn btn-ghost"
                    href={WA + encodeURIComponent('¡Hola Mundo Mágico! Quiero comprar por cantidad, ¿me pasan precios por volumen?')}
                    target="_blank"
                    rel="noopener"
                  >
                    Comprar por cantidad
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="otros">
          <div className="wrap">
            <h2>Seguí explorando otros mundos</h2>
            <div className="otros-grid">
              {OTROS_MUNDOS.map((m) => (
                <a className="otros-card" href={m.href} key={m.nombre}>
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{m.icon}</svg>
                  {m.nombre}
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
