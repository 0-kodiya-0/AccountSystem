/// <reference types="vitest" />
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__test__/*.test.{ts,tsx}'],
    exclude: [
      'node_modules/',
      'dist/',
      '__test__/integration/setup.ts',
      'src/test/setup.ts',
      '__test__/integration/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '__test__/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
    },
    typecheck: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
});
