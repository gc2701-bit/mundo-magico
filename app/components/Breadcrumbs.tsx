import Link from 'next/link';

/**
 * Breadcrumbs reusable (Sprint 3, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * `Inicio › Mundo › Familia (si aplica) › Producto`. El último ítem nunca
 * es link (es la página actual). Incluye JSON-LD BreadcrumbList: la
 * razón original por la que el usuario pidió breadcrumbs fue SEO — sin
 * esto, Google no arma la ruta en los resultados de búsqueda aunque el
 * markup visual esté bien.
 */
export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const siteUrl = 'https://mundomagico.ar';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: siteUrl + item.href } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Ruta de navegación" className="font-body text-fs-1 text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              {item.href ? (
                <Link href={item.href} className="hover:text-ink!">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        // JSON.stringify de datos propios (labels/URLs internas, nunca
        // texto de usuario) — no es el mismo riesgo que innerHTML con
        // datos de terceros.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
