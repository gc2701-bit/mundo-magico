/* app/components/cuenta/CuentaNavButton.tsx — bug reportado por el
 * usuario en mobile: "el botón de usuario no funciona". No era el click
 * (llega bien) sino el menú que abre: .cuenta-pop se posiciona con
 * `top:calc(100% + 8px)` relativo a `.cuenta-nav-wrap` — pensado para el
 * ícono de la fila de arriba del Nav desktop. En mobile ese ícono vive en
 * #nav-mobile-bottom (Nav.tsx), la barra fija pegada al borde de ABAJO de
 * la pantalla: abrir "hacia abajo" ahí manda el menú entero fuera del
 * viewport (confirmado midiendo el layout real con Playwright — 844px de
 * alto, el menú terminaba entre los píxeles 848 y 1086, agent-skills:
 * debugging-and-error-recovery) — invisible e imposible de tocar, aunque
 * el botón sí haya respondido al toque.
 *
 * Mismo criterio que tests/unit/cuenta-nav-position.test.tsx: se carga el
 * CSS real y se afirma con getComputedStyle sobre el SELECTOR, porque el
 * bug (y el fix) están en si la regla de CSS matchea la estructura real
 * — no alcanza con inspeccionar las clases del JSX.
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

describe('CuentaNavButton — menú en la barra inferior de mobile (#nav-mobile-bottom)', () => {
  it('abre hacia ARRIBA (bottom, no top) para no quedar fuera del viewport pegado al borde de abajo', async () => {
    const user = userEvent.setup();
    // Misma estructura que Nav.tsx: el ícono vive dentro de
    // <nav id="nav-mobile-bottom">, distinto del <nav id="nav-desktop">.
    render(
      <nav id="nav-mobile-bottom">
        <CuentaNavButton />
      </nav>
    );

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));

    const pop = screen.getByRole('menu');
    expect(getComputedStyle(pop).top).toBe('auto');
    expect(getComputedStyle(pop).bottom).toBe('calc(100% + 8px)');
  });
});

describe('CuentaNavButton — menú en el nav de desktop (#nav-desktop), sin tocar', () => {
  it('sigue abriendo hacia abajo, como antes', async () => {
    const user = userEvent.setup();
    render(
      <nav id="nav-desktop">
        <CuentaNavButton />
      </nav>
    );

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));

    const pop = screen.getByRole('menu');
    expect(getComputedStyle(pop).top).toBe('calc(100% + 8px)');
  });
});
