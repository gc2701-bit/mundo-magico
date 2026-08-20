import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
  },
  resolve: {
    // Mismo alias que tsconfig.json ("@/*": ["./*"]) — Next.js lo resuelve
    // solo al buildear, pero Vitest (Vite) necesita que se lo digan acá
    // también para los tests que importan archivos de app/ que usan '@/'.
    alias: {
      '@': __dirname,
    },
  },
});
