/**
 * Clasificación de carritos para /admin/carritos (Sprint E del dashboard
 * admin, ver SPEC-dashboard-admin.md). "completado" ya lo resuelve la RPC
 * carritos_admin() (existe un pedido de ese usuario con created_at >= el
 * último evento de su carrito) — esta función pura sólo decide, para los
 * que NO están completados, si ya pasó el umbral de abandono (48hs por
 * default) o si todavía están "en curso" (no hace falta mostrarlos como
 * abandonados, el cliente puede estar armando el pedido ahora mismo).
 *
 * Límite conocido, aceptado en el diseño: usa "el pedido más reciente de
 * ese usuario es posterior al último evento" como señal de completado, no
 * una sesión de carrito delimitada — un pedido nuevo y sin relación,
 * varios días después de un carrito viejo ya abandonado, lo marcaría
 * "completado" igual. Ajustar si en la práctica genera falsos positivos.
 */
export type EstadoCarrito = 'completado' | 'abandonado' | 'en_curso';

export function clasificarCarrito(
  ultimoEventoISO: string,
  completado: boolean,
  ahoraISO: string,
  umbralHoras: number = 48
): EstadoCarrito {
  if (completado) return 'completado';
  const horas = (new Date(ahoraISO).getTime() - new Date(ultimoEventoISO).getTime()) / 3600000;
  return horas >= umbralHoras ? 'abandonado' : 'en_curso';
}
