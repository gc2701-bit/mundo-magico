// next/font/local y next/font/google son una macro del compilador de
// Next.js — no funcionan fuera de su pipeline de build (ver el error real
// que motivó este mock: "default is not a function" al correr un test de
// un componente que importa app/fonts.ts bajo Vitest). Este stub imita la
// forma del objeto que devuelven en producción, lo suficiente para que
// los componentes que solo leen `.variable`/`.className` no rompan en test.
export default function nextFontStub(options) {
  const variable = options?.variable ?? '--font-stub';
  return {
    className: 'next-font-stub',
    variable,
    style: { fontFamily: 'stub' },
  };
}
