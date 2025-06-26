import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock timers
vi.useFakeTimers();

// Global test utilities
export const mockAxiosResponse = (data: any, status = 200) => ({
  data: { success: true, data },
  status,
  statusText: 'OK',
  headers: {},
  config: { url: '/test' },
});

export const mockAxiosError = (message: string, status = 500, code?: string) => {
  const error: any = new Error(message);
  error.response = {
    status,
    data: { success: false, error: { code, message } },
    headers: {},
    config: { url: '/test' },
  };
  error.code = code;
  return error;
};
