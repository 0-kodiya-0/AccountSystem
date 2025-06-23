import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { vi } from 'vitest';

// Import the type augmentation to ensure it's loaded
import '../@types/express/index.d.ts';

// Global test setup
beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();

  // Allow connections to localhost for supertest
  nock.enableNetConnect('127.0.0.1');

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

beforeEach(() => {
  // Clear all nock interceptors before each test
  nock.cleanAll();

  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Verify that all mocked requests were made
  if (!nock.isDone()) {
    console.warn('Pending nock interceptors:', nock.pendingMocks());
    nock.cleanAll();
  }
});

afterAll(() => {
  // Restore HTTP connections
  nock.enableNetConnect();
  nock.restore();

  // Restore console methods
  vi.restoreAllMocks();
});
