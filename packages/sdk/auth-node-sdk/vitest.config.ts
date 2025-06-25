import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.d.ts', 'vitest.config.ts', 'src/**/__tests__/**', 'coverage/**'],
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
