import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/setup/rtl.js'],
  },
  resolve: {
    // Mismo alias que tsconfig.json ("@/*": ["./*"]) — Next.js lo resuelve
    // solo al buildear, pero Vitest (Vite) necesita que se lo digan acá
    // también para los tests que importan archivos de app/ que usan '@/'.
    alias: {
      '@': __dirname,
      // next/font/* es una macro del compilador de Next, no funciona bajo
      // Vitest — se stubea para los tests de componentes que la importan
      // indirectamente (ver tests/mocks/next-font.js).
      'next/font/local': path.join(__dirname, 'tests/mocks/next-font.js'),
      'next/font/google': path.join(__dirname, 'tests/mocks/next-font.js'),
    },
  },
});
