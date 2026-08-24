/**
 * Silueta de carga de ProductoCard.tsx (Sprint 3, ver
 * docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md) —
 * misma forma exacta que la card real (imagen 1:1, tag de familia,
 * título, precio, botón) para no saltar el layout cuando llega el
 * contenido de verdad. `aria-hidden`: es puramente visual, no hay nada
 * que un lector de pantalla necesite anunciar acá.
 */
export default function ProductoCardSkeleton() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-brand border border-line bg-surface"
      aria-hidden="true"
    >
      <div className="aspect-square bg-line" />
      <div className="flex flex-col gap-2 p-s2">
        <div className="h-2.5 w-1/3 rounded bg-line" />
        <div className="h-4 w-4/5 rounded bg-line" />
        <div className="h-5 w-1/2 rounded bg-line" />
        <div className="mt-1 h-8 w-full rounded-brand bg-line" />
      </div>
    </div>
  );
}

export function GrillaSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-s2 md:grid-cols-4 md:gap-s3">
      {Array.from({ length: n }).map((_, i) => (
        <ProductoCardSkeleton key={i} />
      ))}
    </div>
  );
}
