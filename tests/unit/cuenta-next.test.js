/* lib/cuenta.ts — puerto a Next.js de la lógica pura de assets/cuenta.js
 * (Sprint 5, Task 5.1). Mismas reglas que ya cubre
 * tests/unit/cuenta-validarpass.test.js para el sitio viejo — este archivo
 * es su equivalente para el módulo nuevo, más las funciones de
 * fuerzaPassword/mensajeDeError/nombreDe que no tenían test unitario
 * propio en el sitio viejo (vivían mezcladas con el DOM).
 */
import { describe, it, expect } from 'vitest';
import {
  PASS_MIN,
  validarPass,
  fuerzaPassword,
  mensajeDeError,
  nombreDe,
  emailDe,
  direccionDe,
  telefonoDe,
  fechaLegible,
} from '../../lib/cuenta';

describe('validarPass', () => {
  it('rechaza una contraseña de menos de PASS_MIN caracteres', () => {
    expect(PASS_MIN).toBe(6);
    expect(validarPass('Ab1!')).toMatch(/al menos 6 caracteres/);
  });

  it('rechaza sin mayúscula', () => {
    expect(validarPass('abcdef!1')).toMatch(/mayúscula/);
  });

  it('rechaza sin carácter especial', () => {
    expect(validarPass('Abcdef1')).toMatch(/carácter especial/);
  });

  it('acepta una contraseña que cumple las tres reglas', () => {
    expect(validarPass('Abcdef!1')).toBe('');
  });

  it('el largo mínimo se evalúa antes que las otras reglas', () => {
    expect(validarPass('ab')).toMatch(/al menos 6 caracteres/);
  });
});

describe('fuerzaPassword', () => {
  it('null para contraseña vacía (oculta la barra)', () => {
    expect(fuerzaPassword('')).toBeNull();
  });

  it('débil para una contraseña corta y simple', () => {
    expect(fuerzaPassword('abc')?.nivel).toBe('debil');
  });

  it('fuerte para una contraseña larga y variada', () => {
    expect(fuerzaPassword('Abcdefgh1!')?.nivel).toBe('fuerte');
  });
});

describe('mensajeDeError', () => {
  it('traduce "invalid login credentials"', () => {
    expect(mensajeDeError({ message: 'Invalid login credentials' })).toBe('Email o contraseña incorrectos.');
  });

  it('traduce "already registered" a un mensaje ambiguo (no confirma existencia de la cuenta)', () => {
    expect(mensajeDeError({ message: 'User already registered' })).toMatch(/Ya tengo cuenta/);
  });

  it('traduce rate limit', () => {
    expect(mensajeDeError({ message: 'email rate limit exceeded' })).toMatch(/Demasiados intentos/);
  });

  it('sin error, mensaje genérico', () => {
    expect(mensajeDeError(null)).toBe('No se pudo completar. Probá de nuevo.');
  });

  it('mensaje desconocido se muestra tal cual', () => {
    expect(mensajeDeError({ message: 'algo raro pasó' })).toBe('algo raro pasó');
  });
});

describe('datos de sesión', () => {
  const sesion = {
    user: { email: 'a@a.com', user_metadata: { nombre: 'Ana', direccion: 'Calle 123', telefono: '3810000000' } },
  };

  it('nombreDe/emailDe/direccionDe/telefonoDe leen user_metadata', () => {
    expect(nombreDe(sesion)).toBe('Ana');
    expect(emailDe(sesion)).toBe('a@a.com');
    expect(direccionDe(sesion)).toBe('Calle 123');
    expect(telefonoDe(sesion)).toBe('3810000000');
  });

  it('sin sesión, todo devuelve string vacío', () => {
    expect(nombreDe(null)).toBe('');
    expect(emailDe(null)).toBe('');
    expect(direccionDe(null)).toBe('');
    expect(telefonoDe(null)).toBe('');
  });
});

describe('fechaLegible', () => {
  it('reformatea yyyy-mm-dd a dd/mm/yyyy sin pasar por Date (evita el corrimiento UTC)', () => {
    expect(fechaLegible('2026-01-05')).toBe('05/01/2026');
  });
});
