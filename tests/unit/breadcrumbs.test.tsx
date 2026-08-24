/* app/components/Breadcrumbs.tsx — Sprint 3 del rediseño de frontend. */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Breadcrumbs from '../../app/components/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('el último ítem no es link (página actual)', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Cotillón', href: '/globos-fiesta' },
          { label: 'Anteojos' },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Cotillón' })).toHaveAttribute('href', '/globos-fiesta');
    const actual = screen.getByText('Anteojos');
    expect(actual.tagName).toBe('SPAN');
    expect(actual).toHaveAttribute('aria-current', 'page');
  });

  it('arma el JSON-LD de BreadcrumbList para SEO', () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Cotillón' }]} />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent || '{}');
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
    expect(data.itemListElement[0]).toMatchObject({ position: 1, name: 'Inicio' });
  });
});
