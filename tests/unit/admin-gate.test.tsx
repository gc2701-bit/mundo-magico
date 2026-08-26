/* app/components/admin/AdminGate.tsx — dos bugs reportados por el usuario
 * sobre /admin/catalogo en desktop (agent-skills:debugging-and-error-recovery):
 *
 * 1. Un botón "Cerrar sesión" duplicado: el Nav del sitio (app/layout.tsx,
 *    site-wide, también sobre /admin/*) ya trae uno propio en el menú
 *    "Mi cuenta" (CuentaNavButton.tsx) contra la misma sesión de Supabase
 *    Auth — no hace falta uno aparte acá. Se saca del todo, junto con la
 *    función cerrarSesion() que ya no se usa.
 * 2. La tabla de PublicadoTab no ocupaba el 100% del ancho de pantalla:
 *    .adm-wrap (public/assets/admin-catalogo.css) la cappea a 960px, un
 *    ancho pensado para las pantallas angostas de pedidos/envíos
 *    (AdminPedidosGate.tsx/AdminEnviosGate.tsx, que reusan la misma
 *    clase) — nombres/filas quedaban comprimidos aunque las columnas de
 *    la tabla ya sumen 100% de SU contenedor (table-fixed). Fix: clase
 *    modificadora .adm-wrap-catalogo, sólo en este componente, que
 *    levanta el max-width sin tocar .adm-wrap compartida.
 *
 * Igual que tests/unit/cuenta-nav-position.test.tsx: se carga el CSS real
 * y se afirma con getComputedStyle, porque el bug de (2) está en si la
 * regla de CSS efectivamente le gana al max-width heredado, no en el JSX.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AdminGate from '../../app/components/admin/AdminGate';

vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn()
    },
    rpc: () => Promise.resolve({ data: true, error: null })
  })
}));

let estilo: HTMLStyleElement;

beforeEach(() => {
  const css = readFileSync(join(__dirname, '../../public/assets/admin-catalogo.css'), 'utf8');
  estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);
});

afterEach(() => {
  estilo.remove();
  cleanup();
});

describe('AdminGate — sesión admin', () => {
  it('no muestra un botón "Cerrar sesión" propio (el del Nav del sitio ya alcanza)', async () => {
    render(<AdminGate><p>contenido</p></AdminGate>);

    await screen.findByText('contenido');

    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it('el wrap del panel usa .adm-wrap-catalogo, que levanta el max-width de 960px de .adm-wrap', async () => {
    render(<AdminGate><p>contenido</p></AdminGate>);

    await screen.findByText('contenido');

    const wrap = screen.getByText('Catálogo').closest('.adm-wrap')!;
    expect(wrap).toHaveClass('adm-wrap-catalogo');
    expect(getComputedStyle(wrap).maxWidth).toBe('none');
  });
});
