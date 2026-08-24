// Setup global para tests de componentes React (RTL) — sin esto, cada
// render() dentro de un mismo archivo se acumula en el DOM de jsdom en
// vez de limpiarse entre tests (este proyecto no usa `test.globals: true`
// en vitest.config.js, así que el auto-cleanup de Testing Library no se
// registra solo). Se importa una sola vez vía `test.setupFiles`.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
