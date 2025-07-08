// packages/sdk/auth-react-sdk/vitest.integration.config.ts
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
    exclude: ['node_modules/', 'dist/', '__test__/integration/setup.ts'],
    testTimeout: 30000, // 30s default timeout for integration tests
    hookTimeout: 60000, // 60s for setup/teardown hooks
    teardownTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '__test__/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/index.ts', 'dist/'],
      reportsDirectory: 'coverage-integration',
    },
    typecheck: {
      enabled: false,
    },
    reporters: ['verbose'],
    outputFile: {
      json: './test-results-integration.json',
      junit: './test-results-integration.xml',
    },
    // Integration test specific configuration
    pool: 'forks', // Use process isolation for integration tests
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in sequence to avoid conflicts
      },
    },
    // Retry failed tests in CI
    retry: process.env.CI ? 2 : 0,
    // Longer timeouts for CI
    ...(process.env.CI && {
      testTimeout: 60000,
      hookTimeout: 120000,
    }),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  esbuild: {
    target: 'node14',
  },
});
