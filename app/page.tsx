/**
 * Home — rediseño Sprint 4 (ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md):
 * hero compacto (el castillo animado ya no ocupa toda la pantalla) +
 * carrusel de destacados, después 5 vidrieras de mundo con productos
 * reales (Cumpleaños, Cotillón, Decoración, Halloween, Navidad — los
 * otros 4 mundos siguen accesibles desde la grilla "Nuestros mundos" de
 * siempre, el mega-menú del nav y Explorar).
 *
 * Confianza/Reseñas/Historia/Visitanos/Contacto/banda-especial/mundos:
 * SIN CAMBIOS a pedido explícito del usuario — mismo JSX/CSS de siempre
 * (home.css), sólo reordenados. Reseñas siguen siendo inventadas
 * (hardcodeadas) — el usuario lo detectó y pidió dejarlas así por ahora,
 * ver la spec.
 *
 * El hero animado (video del logo + campo de estrellas, HeroAnimado.tsx)
 * tampoco se toca — se le baja la altura mínima por fuera (inline style,
 * gana sin pelear con la cascada de home.css) para que dexe de ser
 * protagonista único de la pantalla, sin tocar su animación interna.
 */
import type { Metadata } from 'next';
import HeroAnimado from './components/HeroAnimado';
import HeroCarrusel from './components/HeroCarrusel';
import Vidriera from './components/Vidriera';
import CatalogoPrecios from './components/CatalogoPrecios';
import { obtenerCatalogoPublico } from '@/lib/catalogo-server';

export const revalidate = false;

export const metadata: Metadata = {
  title: 'Mundo Mágico · Cotillón, decoración y fiestas en Tucumán',
  description:
    '+30 años haciendo magia en Tucumán. Cotillón, decoración, línea de cumpleaños, repostería y disfraces, más de 1.000 productos en un solo lugar. Vos ponés la ocasión, nosotros todo lo demás.',
};

const VIDRIERAS = [
  { mundoSlug: 'cumpleanos', titulo: 'Cumpleaños', icono: '🎂' },
  { mundoSlug: 'globos-fiesta', titulo: 'Cotillón', icono: '🎈' },
  { mundoSlug: 'decoracion', titulo: 'Decoración', icono: '🎀' },
  { mundoSlug: 'halloween', titulo: 'Halloween', icono: '🎃' },
  { mundoSlug: 'navidad', titulo: 'Navidad', icono: '🎄' },
];

const MUNDOS_HOME = [
  { clase: 'm-globos', href: '/globos-fiesta', img: '/assets/mundos/cotillon.jpg', titulo: 'Cotillón', desc: 'Guirnaldas, luces, sombreros y anteojos para vestir cualquier fiesta.' },
  { clase: 'm-cumple', href: '/cumpleanos', img: '/assets/mundos/cumpleanos.jpg', titulo: 'Cumpleaños', desc: 'Todo para decorar el cumple, del mantel a las velitas.' },
  { clase: 'm-disfraces', href: '/disfraces', img: '/assets/mundos/disfraces.jpg', titulo: 'Disfraces y accesorios', desc: 'Disfraces, alas y accesorios para cada personaje.' },
  { clase: 'm-reposteria', href: '/reposteria', img: '/assets/mundos/reposteria.jpg', titulo: 'Repostería', desc: 'Moldes, insumos y toppers para tortas y postres.' },
  { clase: 'm-deco', href: '/decoracion', img: '/assets/mundos/decoracion.jpg', titulo: 'Decoración del hogar', desc: 'Velas, macetas y detalles para ambientar tu casa.' },
  { clase: 'm-combos', href: '/explorar', img: '/assets/mundos/combos.jpg', titulo: 'Combos', desc: 'Kits armados con todo lo necesario, al mejor precio.' },
];

const HISTORIA_FOTOS = [
  { src: '/assets/historia/mostrador-fundadora.jpg', alt: 'La fundadora atendiendo detrás del mostrador', cap: 'Detrás del mostrador', anio: '1998' },
  { src: '/assets/historia/nene-local.jpg', alt: 'Un niño en la puerta del local con el cartel de cotillón', cap: 'En la puerta del local' },
  { src: '/assets/historia/vitrina-navidad.jpg', alt: 'Vidriera de Navidad con Papá Noel y árbol', cap: 'Las vidrieras de siempre' },
  { src: '/assets/historia/nene-disfraz.jpg', alt: 'Un nene chiquito disfrazado entre las estanterías', cap: 'Listos para disfrazarse' },
];

const SUCURSALES = [
  { nombre: 'Junín 351', sub: 'San Miguel de Tucumán', query: 'Mundo+Magico+Junin+351+Tucuman' },
  { nombre: 'Junín 241', sub: 'San Miguel de Tucumán', query: 'Mundo+Magico+Junin+241+Tucuman' },
  { nombre: 'Córdoba 784', sub: 'San Miguel de Tucumán', query: 'Mundo+Magico+Cordoba+784+Tucuman' },
  { nombre: 'Solano Vera 510', sub: 'Yerba Buena · línea propia', query: 'Mundo+Magico+Solano+Vera+510+Yerba+Buena+Tucuman' },
];

const RESENAS = [
  { texto: 'Siempre encontrás lo que buscás. Buena atención y precios.', autor: 'Belén Reynoso', hace: 'Hace 5 años', color: '#ef5c4d', inicial: 'B' },
  { texto: 'Excelentes precios, variedad y atención.', autor: 'Sil Iraidini Taboada', hace: 'Hace 1 año', color: '#2f63cf', inicial: 'S' },
  { texto: 'Muy buena atención.', autor: 'Valeria Roxana Sánchez', hace: 'Hace 2 años', color: '#6f9e5b', inicial: 'V' },
  { texto: 'Muy buena atención, asesoramiento y amabilidad. Los precios accesibles.', autor: 'Laura Paola Hidalgo', hace: 'Hace 4 años', color: '#f0913a', inicial: 'L' },
];

function EstrellasGoogle({ n = 5 }: { n?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n} de 5 estrellas`}>
      {Array.from({ length: n }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.6 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

export default async function Home() {
  const catalogo = await obtenerCatalogoPublico();
  const destacados = catalogo.productos.filter((p) => p.destacadoHome);
  // Fallback mientras no exista curación real desde el panel admin (fuera
  // de alcance de este proyecto, ver la spec) — así el carrusel nunca
  // arranca vacío.
  const heroItems = destacados.length ? destacados : catalogo.productos.slice(0, 6);

  return (
    <>
      <link rel="stylesheet" href="/assets/home.css" />

      <header className="hero" id="inicio" style={{ minHeight: '58svh' }}>
        <HeroAnimado />
        <div className="eyebrow">Cotillón · Tucumán · desde 1994</div>
        <h1>
          <span className="w">Todo</span> <span className="w">para</span> <span className="w">tu</span>{' '}
          <span className="w"><em>fiesta</em>,</span> <span className="w">en</span> <span className="w">un</span>{' '}
          <span className="w">solo</span> <span className="w">lugar</span>
        </h1>
        <p className="hero-lead">
          Cotillón, decoración, cumpleaños, repostería y disfraces. Elegí lo que necesitás, armá tu pedido y
          mandánoslo por WhatsApp en un solo mensaje.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#mundos">Armá tu pedido</a>
          <a className="btn btn-ghost" href="/explorar">Explorar</a>
        </div>

        <a className="hero-cue" href="#historia">
          <span>Conocé la historia</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
      </header>

      <HeroCarrusel productos={heroItems} />

      <main>
        {VIDRIERAS.map((v) => (
          <Vidriera key={v.mundoSlug} titulo={v.titulo} mundoSlug={v.mundoSlug} icono={v.icono} productos={catalogo.productos} />
        ))}

        <section className="mundos" id="mundos">
          <div className="wrap">
            <div className="head">
              <div className="eyebrow">Nuestros mundos</div>
              <h2>Sumergite en nuestros mundos</h2>
              <p className="sub">Todo lo que buscás, en un solo lugar.</p>
            </div>
            <div className="mundo-grid">
              {MUNDOS_HOME.map((m) => (
                <a key={m.clase} className={`mundo ${m.clase}`} href={m.href}>
                  <div className="tile" aria-hidden="true">
                    <img className="tile-img" src={m.img} alt="" width={600} height={432} loading="lazy" />
                  </div>
                  <div className="body">
                    <h3>{m.titulo}</h3>
                    <p className="desc">{m.desc}</p>
                    <span className="go">Entrar al mundo →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="banda-especial" aria-label="Eventos a medida y venta mayorista">
          <div className="wrap banda-inner">
            <span className="banda-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="9" cy="14" r="5" /><circle cx="15" cy="10" r="5" /></svg>
            </span>
            <div className="banda-txt">
              <b>¿Casamiento, 15 años o compra por cantidad?</b>
              <small>Te armamos el evento completo. Y si comprás por cantidad o sos mayorista, también tenemos lo tuyo.</small>
            </div>
            <a className="btn banda-btn" href="/eventos">Ver servicios especiales →</a>
          </div>
        </section>

        <section className="trust" aria-label="Por qué elegirnos">
          <div className="wrap">
            <div className="trust-item">
              <span className="tic">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>
              </span>
              <span><b>+30 años</b><small>Referentes en Tucumán</small></span>
            </div>
            <div className="trust-item">
              <span className="tic">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c3 0 5.5 2.7 5.5 6S14.8 15 12 15s-5.5-3.2-5.5-6.5 2.5-6 5.5-6z" /><path d="M12 15l-1 2.5h2L12 21.5" /></svg>
              </span>
              <span><b>+1.000 productos</b><small>Todo para celebrar</small></span>
            </div>
            <div className="trust-item">
              <span className="tic">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 4V6z" /></svg>
              </span>
              <span><b>Atención personal</b><small>Te asesoramos por WhatsApp</small></span>
            </div>
            <div className="trust-item">
              <span className="tic">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 20v-6h6v6" /></svg>
              </span>
              <span><b>4 sucursales a la calle</b><small>Vení a verlo en persona</small></span>
            </div>
          </div>
        </section>

        <section className="visitanos" id="visitanos">
          <div className="wrap">
            <div className="head">
              <div className="eyebrow">Pasá cuando quieras</div>
              <h2>Cuatro sucursales, una misma atención</h2>
              <p className="sub">Todo cerca, en Tucumán. Vení a verlo en persona.</p>
            </div>
            <div className="vis-split">
              <div className="vis-panel">
                <div className="suc-grid">
                  {SUCURSALES.map((s) => (
                    <a
                      key={s.nombre}
                      className="suc-card"
                      href={`https://www.google.com/maps/search/?api=1&query=${s.query}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <b>{s.nombre}</b>
                      <small>{s.sub}</small>
                      <span className="go">Ver en el mapa →</span>
                    </a>
                  ))}
                </div>
                <div className="hours-pill">
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
                  Lunes a viernes 9–13 y 17–21 · Sábados 9–13:30
                </div>
              </div>
              <div className="vis-photo">
                <img src="/assets/mundos/local-3d-web-wide.jpg" alt="Ilustración 3D del local de Mundo Mágico" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        <section className="resenas" id="resenas" aria-label="Reseñas de Google">
          <div className="wrap">
            <div className="head">
              <div className="eyebrow">Lo que dicen de nosotros</div>
              <h2>Nos recomiendan en Google</h2>
              <p className="sub">Miles de fiestas después, esto es lo que cuentan nuestros clientes.</p>
            </div>

            <div className="gsum">
              <span className="gsum-logo">
                <GoogleMark />
                <b>Google</b>
              </span>
              <div className="gsum-score">
                <span className="num">4,6</span>
                <EstrellasGoogle />
                <small>44 reseñas en Google</small>
              </div>
              <a className="btn btn-primary" href="https://www.google.com/maps?cid=5518163187759882532" target="_blank" rel="noopener">
                Dejá tu reseña →
              </a>
            </div>

            <div className="res-grid">
              {RESENAS.map((r) => (
                <figure className="res-card" key={r.autor}>
                  <span className="gmark"><GoogleMark /></span>
                  <EstrellasGoogle />
                  <blockquote className="quote">{r.texto}</blockquote>
                  <figcaption className="res-author">
                    <span className="res-av" style={{ background: r.color }} aria-hidden="true">{r.inicial}</span>
                    <span><b>{r.autor}</b><small>{r.hace}</small></span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="historia" id="historia">
          <div className="wrap">
            <div className="hist-head">
              <div className="eyebrow">Nuestra historia</div>
              <h2>Más de 30 años haciendo magia en Tucumán</h2>
              <p>Desde 1994, el cotillón de referencia. La misma familia de siempre, con las mismas ganas del primer día.</p>
              <p className="mantra">Vos ponés la ocasión. Nosotros, todo lo demás.</p>
            </div>

            <div className="hist-track">
              {HISTORIA_FOTOS.map((f) => (
                <figure className="hist-frame" key={f.src}>
                  <img src={f.src} alt={f.alt} width={1500} height={1030} loading="lazy" />
                  <figcaption>
                    {f.anio && <span className="hyr">{f.anio}</span>}
                    {f.cap}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="hist-foot">
              <div className="hist-chips">
                <div className="hchip"><b>+30</b><span>Años</span></div>
                <div className="hchip"><b>+1.000</b><span>Productos</span></div>
                <div className="hchip"><b>Nº&nbsp;1</b><span>En cotillón</span></div>
              </div>
              <a className="btn btn-ghost" href="/historia">Ver toda nuestra historia →</a>
            </div>
          </div>
        </section>

        <section className="contacto" id="contacto">
          <div className="wrap">
            <div className="head">
              <div className="eyebrow">Hablemos</div>
              <h2>Contacto</h2>
              <p className="sub">Escribinos por WhatsApp o seguinos en redes para ver las novedades antes que nadie.</p>
            </div>
            <div className="con-grid">
              <a className="con-card" href="https://wa.me/5493813006343?text=%C2%A1Hola%20Mundo%20M%C3%A1gico!%20Quiero%20hacer%20una%20consulta." target="_blank" rel="noopener">
                <span className="con-ic con-wa">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 1 1 6.97 3.86Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" /></svg>
                </span>
                <b>WhatsApp</b>
                <small>+54 9 381 300-6343</small>
                <span className="go">Escribinos →</span>
              </a>
              <a className="con-card" href="https://www.instagram.com/mundo_magico_tuc/" target="_blank" rel="noopener">
                <span className="con-ic con-ig">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.4-11.85a1.44 1.44 0 1 1-1.44 1.44 1.44 1.44 0 0 1 1.44-1.44Z" /></svg>
                </span>
                <b>Instagram</b>
                <small>@mundo_magico_tuc</small>
                <span className="go">Seguinos →</span>
              </a>
              <a className="con-card" href="https://www.instagram.com/mundomagico.yb/" target="_blank" rel="noopener">
                <span className="con-ic con-ig">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.4-11.85a1.44 1.44 0 1 1-1.44 1.44 1.44 1.44 0 0 1 1.44-1.44Z" /></svg>
                </span>
                <b>Instagram Yerba Buena</b>
                <small>@mundomagico.yb</small>
                <span className="go">Seguinos →</span>
              </a>
              <a className="con-card" href="https://www.facebook.com/mundomagicotucuman/" target="_blank" rel="noopener">
                <span className="con-ic con-fb">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95H15.83c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z" /></svg>
                </span>
                <b>Facebook</b>
                <small>Mundo Mágico Tucumán</small>
                <span className="go">Seguinos →</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <CatalogoPrecios />
    </>
  );
}
