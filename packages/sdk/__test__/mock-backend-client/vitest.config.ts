import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test configuration
    globals: true,
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],

    // Timeout configuration
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false, // Allow parallel test execution
        maxThreads: 4,
        minThreads: 1,
      },
    },

    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.config.*', '**/*.test.*', '**/*.spec.*'],
    },

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      MOCK_SERVER_URL: 'http://localhost:3000',
    },

    // Retry configuration for flaky network tests
    retry: 2,

    // Sequence configuration
    sequence: {
      concurrent: true,
      shuffle: false,
    },
  },

  // TypeScript configuration
  esbuild: {
    target: 'node18',
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
