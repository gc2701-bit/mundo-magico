'use client';

/**
 * Error boundary raíz — Sprint 1 de tasks/plan.md (2026-08-28), red de
 * contención agregada tras el incidente del 404 permanente en
 * /[mundo] y /[mundo]/[slug]. No existía ningún error.tsx en el repo:
 * una excepción no capturada durante un render (ej. obtenerCatalogoPublico()
 * tirando porque Supabase no respondió) no tenía dónde caer más que el
 * comportamiento por defecto de Next. El mensaje del error nunca se
 * muestra crudo al usuario (podría filtrar detalle interno) — sólo queda
 * logueado en consola para debugging.
 */
export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof window !== 'undefined') {
    console.error(error);
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-s1 px-s3 py-s8 text-center">
      <span className="text-4xl" aria-hidden="true">
        ⚠️
      </span>
      <p className="font-display text-fs1 font-semibold text-ink">Algo salió mal</p>
      <p className="font-body text-fs-1 text-muted">
        Hubo un problema al cargar esta página. Probá de nuevo en un momento.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-s2 rounded-brand bg-green px-s3 py-s2 font-body text-fs-1 font-semibold text-white! hover:bg-green-ink"
      >
        Reintentar
      </button>
    </div>
  );
}
