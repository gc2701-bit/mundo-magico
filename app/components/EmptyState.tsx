import Link from 'next/link';

/**
 * Estado vacío parametrizable (Sprint 3, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * usado para "sin resultados de búsqueda/filtro" y "mundo sin productos
 * todavía" (Sprint 5). Regla del diseño aprobado: ningún estado queda en
 * blanco sin texto ni salida, siempre hay un mensaje claro y una acción.
 */
export type EmptyStateProps = {
  icono?: string;
  titulo: string;
  descripcion?: string;
  accion?: { label: string; href: string };
};

export default function EmptyState({ icono = '🔍', titulo, descripcion, accion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-s1 px-s3 py-s8 text-center">
      <span className="text-4xl" aria-hidden="true">
        {icono}
      </span>
      <p className="font-display text-fs1 font-semibold text-ink">{titulo}</p>
      {descripcion && <p className="font-body text-fs-1 text-muted">{descripcion}</p>}
      {accion && (
        <Link
          href={accion.href}
          className="mt-s2 rounded-brand bg-green px-s3 py-s2 font-body text-fs-1 font-semibold text-white! hover:bg-green-ink"
        >
          {accion.label}
        </Link>
      )}
    </div>
  );
}
