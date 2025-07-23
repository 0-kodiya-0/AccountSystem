import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2022-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
