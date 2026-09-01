/* app/components/ProductoGaleria.tsx — fix imagen rota: subirFoto()
 * devuelve una URL pública completa de Supabase, pero este componente
 * anteponía '/' a ciegas asumiendo siempre una ruta relativa del sitio
 * HTML viejo (ver tasks/plan-imagenes-productos.md, Sprint 0).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductoGaleria from '../../app/components/ProductoGaleria';

const URL_SUPABASE = 'https://kyuilrlewynqrzebouww.supabase.co/storage/v1/object/public/catalogo/x.webp';

describe('ProductoGaleria', () => {
  it('sin fotos: muestra el logo genérico', () => {
    render(<ProductoGaleria fotos={[]} titulo="Bolsas de papel" />);
    expect(screen.getByAltText('')).toBeInTheDocument();
  });

  it('foto principal con URL completa de Supabase: el src es esa URL, no "/https://..."', () => {
    render(<ProductoGaleria fotos={[{ src: URL_SUPABASE, cap: '' }]} titulo="Bolsas de papel" />);
    expect(screen.getByAltText('Bolsas de papel')).toHaveAttribute('src', URL_SUPABASE);
  });

  it('miniatura con URL completa de Supabase: el src es esa URL, no "/https://..."', () => {
    const otra = URL_SUPABASE.replace('x.webp', 'y.webp');
    render(
      <ProductoGaleria
        fotos={[
          { src: URL_SUPABASE, cap: 'Rojo' },
          { src: otra, cap: 'Azul' }
        ]}
        titulo="Bolsas de papel"
      />
    );
    expect(screen.getByRole('tab', { name: 'Azul' }).querySelector('img')).toHaveAttribute('src', otra);
  });

  it('fotoDestacada: reemplaza toda la galería por esa única imagen', () => {
    render(<ProductoGaleria fotos={[{ src: 'productos/x.jpg', cap: '' }]} titulo="X" fotoDestacada={URL_SUPABASE} />);
    expect(screen.getByAltText('X')).toHaveAttribute('src', URL_SUPABASE);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
