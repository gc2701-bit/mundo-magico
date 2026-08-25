/* app/components/cuenta/CuentaNavButton.tsx — bug reportado por el
 * usuario: en desktop, al abrir "Mi cuenta" el desplegable (.cuenta-pop)
 * aparecía muy abajo de la pantalla, casi invisible ("pensé que estaba
 * roto"). Root cause (agent-skills:debugging-and-error-recovery): el CSS
 * legacy (public/assets/cuenta.css) posiciona el desplegable con
 * `.cuenta-pop{ position:absolute; top:calc(100% + 8px) }`, anclado a
 * `.cuenta-nav-wrap{ position:relative }` — pero esa regla de
 * position:relative está escrita como `.nav .cuenta-nav-wrap{...}`
 * (selector heredado de la maqueta vieja _includes/nav.njk, que envolvía
 * todo en <nav class="nav">). El rediseño del Nav (Sprint 2,
 * app/components/Nav.tsx) NO usa esa clase — el <nav> desktop es
 * `id="nav-desktop"` con clases de Tailwind, sin `class="nav"`. El
 * selector nunca matchea, `.cuenta-nav-wrap` se queda con
 * `position:static`, y `.cuenta-pop` (sin ancestro posicionado) termina
 * anclado al initial containing block en vez de al botón — de ahí que
 * apareciera lejos, hacia el fondo del documento.
 *
 * Este test monta CuentaNavButton dentro de la MISMA estructura que
 * Nav.tsx realmente usa (un <nav id="nav-desktop"> sin class="nav") y
 * carga el CSS real de cuenta.css, para que el bug (y su fix) se vea en
 * getComputedStyle — no alcanza con un test que sólo lea las clases del
 * componente, porque el bug está en si el SELECTOR del CSS matchea la
 * estructura real, no en el JSX en sí.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CuentaNavButton from '../../app/components/cuenta/CuentaNavButton';

const SESION_FALSA = { user: { id: 'u1', email: 'ana@example.com', user_metadata: { nombre: 'Ana' } } };

vi.mock('@/app/components/cuenta/CuentaProvider', () => ({
  useCuenta: () => ({
    sesion: SESION_FALSA,
    esAdmin: false,
    pedirSesion: vi.fn(),
    abrirAjustes: vi.fn(),
    abrirFavoritos: vi.fn(),
    cerrarSesion: vi.fn()
  })
}));

let estilo: HTMLStyleElement;

beforeEach(() => {
  const css = readFileSync(join(__dirname, '../../public/assets/cuenta.css'), 'utf8');
  estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);
});

afterEach(() => {
  estilo.remove();
  cleanup();
});

describe('CuentaNavButton — posición del desplegable', () => {
  it('el ancestro .cuenta-nav-wrap queda position:relative dentro del <nav id="nav-desktop"> real (sin class="nav")', async () => {
    const user = userEvent.setup();
    // Misma estructura que app/components/Nav.tsx: <nav id="nav-desktop">
    // con clases de Tailwind, SIN class="nav" (esa clase es de la maqueta
    // vieja que este componente ya no usa).
    render(
      <nav id="nav-desktop" className="flex items-center gap-s3">
        <CuentaNavButton />
      </nav>
    );

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));

    const pop = screen.getByRole('menu');
    const wrap = pop.parentElement!;
    expect(wrap).toHaveClass('cuenta-nav-wrap');
    expect(getComputedStyle(wrap).position).toBe('relative');
  });
});
