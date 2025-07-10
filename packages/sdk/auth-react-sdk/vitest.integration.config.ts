/// <reference types="vitest" />
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__test__/integration/setup.ts'],
    include: ['__test__/integration/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules/',
      'dist/',
      '__test__/integration/setup.ts',
      'src/test/setup.ts',
      'src/**/__test__/*.test.{ts,tsx}',
    ],
    testTimeout: 30000, // 30s default timeout for integration tests
    hookTimeout: 60000, // 60s for setup/teardown hooks
    teardownTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__test__/setup.ts',
        'src/test/',
        'src/**/__test__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'dist/',
      ],
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
