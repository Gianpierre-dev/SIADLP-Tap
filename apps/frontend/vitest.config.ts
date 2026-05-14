import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests-e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Coverage aplica solo a archivos cubiertos por component tests.
      // Páginas Next.js (app/**/page.tsx, layout.tsx) son responsabilidad
      // de los E2E tests con Playwright, no de component tests.
      // A medida que se agreguen tests de componentes, ampliar este include.
      include: [
        'src/lib/utils.ts',
        'src/lib/api.ts',
        'src/lib/auth.ts',
        'src/lib/empresa.ts',
        'src/components/ui/button.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/badge.tsx',
        'src/components/ui/label.tsx',
      ],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/types.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
