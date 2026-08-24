/* app/design-preview/page.tsx — página de verificación de los tokens de
 * diseño migrados de assets/v2.css a Tailwind/shadcn (Sprint 0 del
 * rediseño de frontend). No prueba supabase-js ni datos — solo que el
 * componente arma las clases de token esperadas y que no quedó ningún
 * rastro de Caveat (reemplazado por Fraunces itálica, decisión explícita
 * del usuario).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// El setup global (tests/setup/rtl.js) ya registra el cleanup y hace este
// mismo import en runtime, pero es un .js — TypeScript no lo incluye en
// su chequeo (tsconfig.json solo incluye **/*.ts y **/*.tsx), así que la
// augmentación de tipos de jest-dom (toHaveClass, toBeInTheDocument...) no
// llega a este archivo sin repetir el import acá.
import '@testing-library/jest-dom/vitest';
import DesignPreviewPage from '../../app/design-preview/page';

describe('DesignPreviewPage — tokens de diseño', () => {
  it('usa los tokens de tipografía de marca (Fraunces/Nunito Sans)', () => {
    render(<DesignPreviewPage />);
    const titulo = screen.getByRole('heading', { level: 1, name: 'Tokens de diseño' });
    expect(titulo).toHaveClass('font-display');
  });

  it('el detalle usa Fraunces itálica, nunca Caveat', () => {
    render(<DesignPreviewPage />);
    const detalle = screen.getByText(/Fraunces itálica — detalle/);
    expect(detalle).toHaveClass('font-display', 'italic');
    expect(detalle.className).not.toMatch(/caveat/i);
  });

  it('los botones shadcn están themeados con la paleta de marca (variant, no color a mano)', () => {
    render(<DesignPreviewPage />);
    expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('la card de producto de ejemplo usa el token de precio/mundo esperado', () => {
    render(<DesignPreviewPage />);
    expect(screen.getByText('Anteojo estrella')).toBeInTheDocument();
    expect(screen.getByText('Cotillón · $3.900')).toBeInTheDocument();
  });
});
