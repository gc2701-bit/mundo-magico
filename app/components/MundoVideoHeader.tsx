/**
 * Header en video de un mundo (Sprint 5) — sólo se renderiza si ese
 * mundo tiene video (lib/mundo-videos.ts). Autoplay/muted/loop/
 * playsinline con preload="none" (mismo criterio que ya usaba el sitio
 * viejo para estos videos) — no es candidato a LCP como el del home
 * (HeroAnimado.tsx), así que no hace falta la misma optimización ahí.
 */
export default function MundoVideoHeader({ src, nombre }: { src: string; nombre: string }) {
  return (
    <div className="relative h-40 overflow-hidden md:h-64">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        src={encodeURI(src)}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" aria-hidden="true" />
      <span className="absolute bottom-s2 left-s3 font-display text-fs2 font-semibold text-white md:bottom-s3 md:left-s5 md:text-fs3">
        {nombre}
      </span>
    </div>
  );
}
