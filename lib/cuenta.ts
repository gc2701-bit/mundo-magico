import type { Session } from '@supabase/supabase-js';

/**
 * Lógica pura de cuenta de cliente (Supabase Auth), portada de
 * public/assets/cuenta.js — mismas reglas, mismos mensajes, para no romper
 * la paridad de UX con el sitio viejo mientras convive con él (Sprint 5).
 */

// Tiene que coincidir con el mínimo configurado en Supabase (Authentication
// → Providers → Email → Minimum password length). Si cambiás uno, cambiá
// el otro.
export const PASS_MIN = 6;

// Reglas de contraseña compartidas entre alta, cambio de contraseña y
// recuperación — una sola fuente de verdad.
export function validarPass(pass: string): string {
  if (pass.length < PASS_MIN) return `La contraseña tiene que tener al menos ${PASS_MIN} caracteres.`;
  if (!/[A-Z]/.test(pass)) return 'La contraseña tiene que tener al menos una mayúscula.';
  if (!/[^A-Za-z0-9]/.test(pass)) return 'La contraseña tiene que tener al menos un carácter especial (ej: !@#$%).';
  return '';
}

export type NivelFuerza = 'debil' | 'media' | 'fuerte';

// Puntaje simple (0-6): sólo una guía visual, la regla real que bloquea el
// envío es validarPass().
export function fuerzaPassword(pass: string): { nivel: NivelFuerza; etiqueta: string } | null {
  if (!pass) return null;
  let puntos = 0;
  if (pass.length >= 6) puntos++;
  if (pass.length >= 10) puntos++;
  if (/[a-z]/.test(pass)) puntos++;
  if (/[A-Z]/.test(pass)) puntos++;
  if (/[0-9]/.test(pass)) puntos++;
  if (/[^A-Za-z0-9]/.test(pass)) puntos++;

  const nivel: NivelFuerza = puntos <= 2 ? 'debil' : puntos <= 4 ? 'media' : 'fuerte';
  const etiqueta = nivel === 'debil' ? 'Débil' : nivel === 'media' ? 'Media' : 'Fuerte';
  return { nivel, etiqueta };
}

// Mensajes de Supabase llegan en inglés; se traducen los casos más comunes
// para no mostrarle inglés técnico al cliente.
export function mensajeDeError(err: { message?: string } | null | undefined): string {
  const m = err?.message || '';
  if (/new password should be different|different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta de la actual.';
  // No confirmamos si el email ya existe (evita que alguien use el alta
  // para averiguar qué direcciones están registradas): mensaje ambiguo en
  // vez de "ese email ya tiene una cuenta".
  if (/already registered|already exists/i.test(m)) return 'No pudimos crear la cuenta con esos datos. Si ya tenés una cuenta con ese email, probá "Ya tengo cuenta".';
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/password.*(least|short|characters)/i.test(m)) return `La contraseña tiene que tener al menos ${PASS_MIN} caracteres.`;
  if (/invalid email/i.test(m)) return 'Revisá el email, no parece válido.';
  if (/rate limit|too many requests/i.test(m)) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  if (m) return m;
  return 'No se pudo completar. Probá de nuevo.';
}

export function nombreDe(sesion: Session | null): string {
  return (sesion?.user?.user_metadata?.nombre as string) || '';
}

export function emailDe(sesion: Session | null): string {
  return sesion?.user?.email || '';
}

export function direccionDe(sesion: Session | null): string {
  return (sesion?.user?.user_metadata?.direccion as string) || '';
}

export function telefonoDe(sesion: Session | null): string {
  return (sesion?.user?.user_metadata?.telefono as string) || '';
}

// Igual que fechaLegible de assets/carrito.js: reformatea "yyyy-mm-dd" a
// mano para no depender de `new Date(iso)`, que interpreta la fecha en UTC
// y puede mostrar el día anterior en husos horarios negativos.
export function fechaLegible(iso: string): string {
  const p = iso.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export const ESTADOS_TXT: Record<string, string> = {
  nuevo: 'Nuevo',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
