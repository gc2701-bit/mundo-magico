/**
 * Puerto de historia-v2.html (sitio Eleventy viejo) — álbum hojeable con
 * las fotos de los primeros años del negocio. No estaba migrada,
 * encontrada en el inventario de páginas del sitio viejo tras el
 * incidente de producción del home (2026-08-21, ver "Corte a
 * producción" en el plan). Mismo contenido, mismas 15 hojas, mismo
 * álbum interactivo (page-flip) — ver AlbumHistoria.tsx.
 */
import type { Metadata } from 'next';
import AlbumHistoria from '../components/AlbumHistoria';

export const metadata: Metadata = {
  title: 'Nuestra historia · +30 años · Mundo Mágico Tucumán',
  description:
    'Más de 30 años haciendo magia en Tucumán. Un recorrido en fotos por los primeros años de Mundo Mágico: el local, las vidrieras y la familia detrás del mostrador.',
};

type Foto = { src: string; webp?: string; alt: string; w: number; h: number; pos?: string };
type Pagina =
  | { tipo: 'cover'; back?: boolean; titulo?: string }
  | { tipo: 'note'; titulo: string; texto: string }
  | { tipo: 'photo'; era: string; claseEra: string; layout: 'one' | 'two' | 'one-crop' | 'crop'; fotos: Foto[] }
  | { tipo: 'video'; era: string; claseEra: string; src: string; label: string; controls?: boolean; loop?: boolean };

const PAGINAS: Pagina[] = [
  { tipo: 'cover' },
  { tipo: 'note', titulo: 'Bienvenidos', texto: 'Pasá las páginas y recorré nuestros primeros años en Tucumán, foto por foto.' },
  {
    tipo: 'photo', era: '1998 · Los inicios', claseEra: 'e-inicios', layout: 'one-crop',
    fotos: [{ src: '/assets/historia/inicios-silvia.jpg', alt: 'Silvia, fundadora de Mundo Mágico, en el local original rodeada de cotillón', w: 1026, h: 766, pos: 'center 45%' }],
  },
  {
    tipo: 'photo', era: '1998 · Los inicios', claseEra: 'e-inicios', layout: 'two',
    fotos: [
      { src: '/assets/historia/mostrador-fundadora.jpg', webp: '/assets/historia/mostrador-fundadora.webp', alt: 'La fundadora atendiendo detrás del mostrador', w: 1500, h: 1030 },
      { src: '/assets/historia/interior-local.jpg', webp: '/assets/historia/interior-local.webp', alt: 'Interior del local repleto de cotillón', w: 1500, h: 1073 },
    ],
  },
  {
    tipo: 'photo', era: 'Las vidrieras', claseEra: 'e-vidrieras', layout: 'two',
    fotos: [
      { src: '/assets/historia/vitrina-navidad.jpg', webp: '/assets/historia/vitrina-navidad.webp', alt: 'Vidriera de Navidad con Papá Noel y árbol', w: 1500, h: 1022 },
      { src: '/assets/historia/vitrina-halloween-98.jpg', webp: '/assets/historia/vitrina-halloween-98.webp', alt: 'Vidriera de Halloween de 1998', w: 1500, h: 1031 },
    ],
  },
  {
    tipo: 'photo', era: 'Las vidrieras', claseEra: 'e-vidrieras', layout: 'two',
    fotos: [
      { src: '/assets/historia/vitrina-halloween.jpg', webp: '/assets/historia/vitrina-halloween.webp', alt: 'Vidriera de Halloween repleta de máscaras', w: 1500, h: 1045 },
      { src: '/assets/historia/vitrina-navidad-calle.jpg', webp: '/assets/historia/vitrina-navidad-calle.webp', alt: 'Vidriera de Navidad con gente pasando', w: 1500, h: 1007 },
    ],
  },
  {
    tipo: 'photo', era: 'Carnaval y disfraces', claseEra: 'e-carnaval', layout: 'two',
    fotos: [
      { src: '/assets/historia/mascaras-carnaval.jpg', webp: '/assets/historia/mascaras-carnaval.webp', alt: 'Pared roja cubierta de máscaras venecianas', w: 1500, h: 1037 },
      { src: '/assets/historia/cabezas-carnaval.jpg', webp: '/assets/historia/cabezas-carnaval.webp', alt: 'Cabezas con máscaras y tocados de carnaval', w: 1400, h: 2159 },
    ],
  },
  {
    tipo: 'photo', era: 'Carnaval y disfraces', claseEra: 'e-carnaval', layout: 'two',
    fotos: [
      { src: '/assets/historia/vitrina-mascaras.jpg', webp: '/assets/historia/vitrina-mascaras.webp', alt: 'Vidriera con antifaces y galeras', w: 1500, h: 1031 },
      { src: '/assets/historia/disfraces-patrios.jpg', webp: '/assets/historia/disfraces-patrios.webp', alt: 'Vidriera con trajes patrios y de época', w: 1500, h: 2229 },
    ],
  },
  {
    tipo: 'photo', era: 'Nuestra gente', claseEra: 'e-gente', layout: 'one',
    fotos: [{ src: '/assets/historia/nene-local.jpg', webp: '/assets/historia/nene-local.webp', alt: 'Niño sonriendo en la puerta del local con el cartel de cotillón', w: 1500, h: 1074 }],
  },
  {
    tipo: 'photo', era: 'Nuestra gente', claseEra: 'e-gente', layout: 'crop',
    fotos: [
      { src: '/assets/historia/nene-disfraz.jpg', webp: '/assets/historia/nene-disfraz.webp', alt: 'Nene chiquito disfrazado entre las estanterías', w: 1500, h: 2265, pos: 'center 28%' },
      { src: '/assets/historia/inicios-empleados.jpg', alt: 'El equipo de Mundo Mágico detrás del mostrador en los primeros años', w: 955, h: 744, pos: 'center 15%' },
    ],
  },
  {
    tipo: 'photo', era: 'Las vidrieras', claseEra: 'e-vidrieras', layout: 'two',
    fotos: [
      { src: '/assets/historia/vitrina-halloween-color.jpg', webp: '/assets/historia/vitrina-halloween-color.webp', alt: 'Vidriera de Halloween', w: 1440, h: 810 },
      { src: '/assets/historia/vitrina-infantil.jpg', webp: '/assets/historia/vitrina-infantil.webp', alt: 'Vidriera con artículos infantiles', w: 960, h: 720 },
    ],
  },
  {
    tipo: 'photo', era: 'Las vidrieras', claseEra: 'e-vidrieras', layout: 'one',
    fotos: [{ src: '/assets/historia/vitrina-surtido.jpg', webp: '/assets/historia/vitrina-surtido.webp', alt: 'Vidriera repleta de cotillón', w: 1440, h: 1440 }],
  },
  {
    tipo: 'photo', era: 'Las sucursales', claseEra: 'e-sucursales', layout: 'one',
    fotos: [{ src: '/assets/historia/sucursal-junin-241.jpg', webp: '/assets/historia/sucursal-junin-241.webp', alt: 'Frente de la sucursal de Junín 241', w: 1032, h: 581 }],
  },
  { tipo: 'video', era: 'Renovando', claseEra: 'e-hoy', src: '/assets/historia/Renovando.mp4', label: 'Renovando el local de Mundo Mágico', loop: true, controls: true },
  { tipo: 'video', era: 'En la tele', claseEra: 'e-hoy', src: '/assets/historia/Canal-8-TV.mp4', label: 'Nota de Canal 8 (elocho TV) en Mundo Mágico', controls: true },
  { tipo: 'note', titulo: 'Y lo que sigue…', texto: 'Seguimos haciendo magia en Tucumán, un festejo a la vez.' },
  { tipo: 'cover', back: true },
];

function FotoFrame({ f }: { f: Foto }) {
  const img = (
    <img src={f.src} alt={f.alt} width={f.w} height={f.h} loading="eager" style={f.pos ? { objectPosition: f.pos } : undefined} />
  );
  return (
    <figure className="pframe">
      {f.webp ? (
        <picture>
          <source srcSet={f.webp} type="image/webp" />
          {img}
        </picture>
      ) : (
        img
      )}
    </figure>
  );
}

export default function HistoriaPage() {
  return (
    <>
      <link rel="stylesheet" href="/assets/historia.css" />
      <a className="skip-link" href="#historia">Saltar al contenido</a>

      <main>
        <header className="story-hero" id="historia">
          <div className="wrap">
            <a className="backlink" href="/">← Volver al inicio</a>
            <div className="eyebrow">Más de 30 años de magia</div>
            <h1>Nuestra <em>historia</em></h1>
            <p className="lead">
              Desde 1994 haciendo magia en Tucumán. Pasá las páginas del álbum y recorré nuestros primeros años: el
              local, las vidrieras y la familia detrás del mostrador.
            </p>
            <div className="stats">
              <div className="stat"><b>+30</b><span>Años</span></div>
              <div className="stat"><b>+1.000</b><span>Productos</span></div>
              <div className="stat"><b>Nº&nbsp;1</b><span>En cotillón</span></div>
              <div className="stat"><b>4</b><span>Sucursales</span></div>
            </div>
          </div>
        </header>

        <section className="album-section">
          <div className="stage-decor" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div>
          <div className="wrap">
            <AlbumHistoria>
              {PAGINAS.map((p, i) => {
                if (p.tipo === 'cover') {
                  return (
                    <div className={'page page-cover' + (p.back ? ' back' : '')} data-density="hard" key={i}>
                      <div className="page-inner">
                        <div className="cover-emblem" aria-hidden="true">✦</div>
                        {!p.back && (
                          <>
                            <div className="ov">Más de 30 años de magia</div>
                            <h2>Nuestra<br />historia</h2>
                          </>
                        )}
                        <div className="sub">Mundo Mágico · {p.back ? 'Tucumán' : 'desde 1994'}</div>
                        <div className="cover-rule" aria-hidden="true" />
                      </div>
                    </div>
                  );
                }
                if (p.tipo === 'note') {
                  return (
                    <div className="page page-note" key={i}>
                      <div className="page-inner">
                        {p.titulo === 'Y lo que sigue…' && <span className="page-era e-hoy">Hoy</span>}
                        <h3>{p.titulo}</h3>
                        <p>{p.texto}</p>
                      </div>
                    </div>
                  );
                }
                if (p.tipo === 'video') {
                  return (
                    <div className="page page-photo" key={i}>
                      <div className="page-inner">
                        <span className={'page-era ' + p.claseEra}>{p.era}</span>
                        <div className="photos one">
                          <figure className="pframe">
                            <video
                              src={p.src}
                              muted={p.loop}
                              loop={p.loop}
                              playsInline
                              controls={p.controls}
                              preload="metadata"
                              aria-label={p.label}
                            />
                          </figure>
                        </div>
                      </div>
                    </div>
                  );
                }
                const claseFotos = 'photos' + (p.layout === 'one' || p.layout === 'one-crop' ? ' one' : '') + (p.layout === 'crop' || p.layout === 'one-crop' ? ' crop' : '');
                return (
                  <div className="page page-photo" key={i}>
                    <div className="page-inner">
                      <span className={'page-era ' + p.claseEra}>{p.era}</span>
                      <div className={claseFotos}>
                        {p.fotos.map((f) => (
                          <FotoFrame f={f} key={f.src} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </AlbumHistoria>
          </div>
        </section>

        <section className="story-cta">
          <div className="wrap">
            <div className="inner">
              <h2>Y el álbum sigue creciendo 📸</h2>
              <p>Cada fiesta suma una foto más. Pasá por el local o escribinos.</p>
              <div className="btns">
                <a className="btn btn-primary" href="/#visitanos">Visitá el local</a>
                <a className="btn btn-ghost" href="/#mundos">Ver nuestros mundos</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
