/**
 * Íconos de línea (siluetas) para el badge de cada vidriera del home
 * (2026-09-09) — pedido explícito del usuario: reemplazar los emojis
 * coloridos (🎂🎈🎀🎃🎄) por íconos monocromáticos, "que no se pierdan
 * contra el fondo". Paths/viewBox/stroke-width EXACTOS medidos con
 * Playwright contra "Mundo Magico - Home (standalone).html" (uno por
 * categoría, no inventados) — `stroke="currentColor"` a propósito: el
 * badge que envuelve a cada ícono ya define `text-white` (ver
 * VidrieraHeader en Vidriera.tsx), así que el ícono hereda ese color
 * automáticamente sin tener que repetirlo acá — siempre queda blanco
 * sobre el color de marca de esa categoría, nunca invisible.
 */
type IconoProps = { className?: string };

const BASE = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconoCumpleanos({ className = 'h-[22px] w-[22px]' }: IconoProps) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      <path d="M4 21v-7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7" />
      <path d="M4 21h16" />
      <path d="M8 11V7" />
      <path d="M12 11V6" />
      <path d="M16 11V7" />
    </svg>
  );
}

export function IconoCotillon({ className = 'h-[22px] w-[22px]' }: IconoProps) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M5 5l2.5 2.5" />
      <path d="M16.5 16.5L19 19" />
      <path d="M19 5l-2.5 2.5" />
      <path d="M7.5 16.5L5 19" />
    </svg>
  );
}

export function IconoDecoracion({ className = 'h-[22px] w-[22px]' }: IconoProps) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.8-.8 1.8-1.8 0-.9-.7-1.5-1-2.4-.3-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-4.4-4-7-9-7Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="11" cy="7.3" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </svg>
  );
}

export function IconoHalloween({ className = 'h-[22px] w-[22px]' }: IconoProps) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      <path d="M5 20V11a7 7 0 1 1 14 0v9l-2.5-2-2 2-2.5-2-2 2-2.5-2L5 20Z" />
      <circle cx="9.5" cy="10.5" r="1" />
      <circle cx="14.5" cy="10.5" r="1" />
    </svg>
  );
}

export function IconoNavidad({ className = 'h-[26px] w-[26px]' }: IconoProps) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="4" y1="7" x2="20" y2="17" />
      <line x1="20" y1="7" x2="4" y2="17" />
    </svg>
  );
}
