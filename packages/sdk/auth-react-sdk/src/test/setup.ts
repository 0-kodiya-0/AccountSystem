import { beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    search: '',
    pathname: '/',
    replace: vi.fn(),
    assign: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

// Mock window.history
Object.defineProperty(window, 'history', {
  value: {
    replaceState: vi.fn(),
    pushState: vi.fn(),
  },
  writable: true,
});

// Mock URLSearchParams
global.URLSearchParams = URLSearchParams;

// Mock URL constructor
global.URL = URL;

// Cleanup after each test
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  // Reset location mock
  window.location.search = '';
  window.location.pathname = '/';
  window.location.href = 'http://localhost:3000';

  // Reset fetch mock
  (global.fetch as any).mockClear();
});
