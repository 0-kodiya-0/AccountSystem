import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Integration test configuration
export const INTEGRATION_CONFIG = {
  // These should be set via environment variables in CI/CD
  SERVER_URL: process.env.VITE_TEST_SERVER_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.VITE_TEST_FRONTEND_URL || 'http://localhost:3000',

  // Test timeouts
  DEFAULT_TIMEOUT: 30000,
  LONG_TIMEOUT: 60000,

  // Test user credentials
  TEST_USER: {
    email: 'test.integration@example.com',
    username: 'integrationtest',
    password: 'TestPassword123!',
    firstName: 'Integration',
    lastName: 'Test',
  },

  // OAuth test credentials (these would need to be real but limited test accounts)
  OAUTH_TEST: {
    GOOGLE: {
      // Note: These would need to be real OAuth test credentials
      // For integration tests, you'd need test OAuth apps set up
      enabled: false, // Set to true when OAuth test credentials are available
      clientId: process.env.VITE_GOOGLE_CLIENT_ID || '',
      testAccount: {
        email: 'test.oauth.google@example.com',
        // OAuth flows would require browser automation or special test endpoints
      },
    },
    MICROSOFT: {
      enabled: false,
      clientId: process.env.VITE_MICROSOFT_CLIENT_ID || '',
    },
    FACEBOOK: {
      enabled: false,
      clientId: process.env.VITE_FACEBOOK_CLIENT_ID || '',
    },
  },
};

// Global test state
export const testState = {
  createdAccountIds: new Set<string>(),
  createdEmails: new Set<string>(),
  serverHealthy: false,
};

// Server health check
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${INTEGRATION_CONFIG.SERVER_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.warn('Server health check failed:', error);
    return false;
  }
};

// Clean up test data
export const cleanupTestData = async () => {
  // Clean up any created test accounts
  for (const accountId of testState.createdAccountIds) {
    try {
      // Note: This would require a test cleanup endpoint on the server
      await fetch(`${INTEGRATION_CONFIG.SERVER_URL}/test/cleanup/account/${accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.warn(`Failed to cleanup account ${accountId}:`, error);
    }
  }

  // Clean up any test emails/signups
  for (const email of testState.createdEmails) {
    try {
      await fetch(`${INTEGRATION_CONFIG.SERVER_URL}/test/cleanup/email/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.warn(`Failed to cleanup email ${email}:`, error);
    }
  }

  testState.createdAccountIds.clear();
  testState.createdEmails.clear();
};

// Integration test hooks
beforeAll(async () => {
  console.log('Starting integration tests...');
  console.log('Server URL:', INTEGRATION_CONFIG.SERVER_URL);

  // Check server health
  testState.serverHealthy = await checkServerHealth();

  if (!testState.serverHealthy) {
    console.warn('Warning: Server health check failed. Some tests may fail.');
  }
}, INTEGRATION_CONFIG.LONG_TIMEOUT);

beforeEach(() => {
  // Reset any global state before each test
  cleanup();
});

afterEach(async () => {
  // Clean up after each test
  cleanup();
});

afterAll(async () => {
  console.log('Cleaning up integration test data...');
  await cleanupTestData();
}, INTEGRATION_CONFIG.LONG_TIMEOUT);

// Utility to generate unique test data
export const generateTestData = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    email: `test.${timestamp}.${random}@integration.test`,
    username: `testuser${timestamp}${random}`,
    accountId: '', // Will be filled by actual responses
  };
};

// Wait for async operations with timeout
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

// Cookie utility functions for testing
export const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

export const clearAllCookies = () => {
  if (typeof document === 'undefined') return;

  document.cookie.split(';').forEach((cookie) => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
};
