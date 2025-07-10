import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MockService } from 'mock-backend-client';
import { resetAppStore } from '../../src/store/useAppStore';

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
      enabled: false,
      clientId: process.env.VITE_GOOGLE_CLIENT_ID || '',
      testAccount: {
        email: 'test.oauth.google@example.com',
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

// Global test state with mock service support
export const testState = {
  createdAccountIds: new Set<string>(),
  createdEmails: new Set<string>(),
  serverHealthy: false,
  mockService: null as MockService | null,
};

// Initialize mock service
const initializeMockService = (): MockService => {
  if (!testState.mockService) {
    testState.mockService = new MockService({
      baseUrl: INTEGRATION_CONFIG.SERVER_URL,
      enableLogging: true,
      withCredentials: true,
    });
  }
  return testState.mockService;
};

// Check if server is available by trying to create mock service
const checkServerAvailability = async (): Promise<boolean> => {
  try {
    const mockService = initializeMockService();
    // Try a simple ping to verify server is responding
    await mockService.ping();
    return true;
  } catch (error) {
    console.warn('Server availability check failed:', error);
    return false;
  }
};

// Clean up test data using mock service
export const cleanupTestData = async () => {
  const mockService = testState.mockService;

  if (mockService) {
    try {
      // Clear all test emails from mock service
      await mockService.clearAllEmails();
      console.log('Cleared all test emails from mock service');

      // Clear OAuth mock cache
      await mockService.clearOAuthMockCache();
      console.log('Cleared OAuth mock cache');

      // Clear tokens for created accounts
      for (const accountId of testState.createdAccountIds) {
        try {
          await mockService.clearTokens(accountId);
        } catch (error) {
          console.warn(`Failed to clear tokens for account ${accountId}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup mock service data:', error);
    }
  }

  // Clean up any created test accounts
  for (const accountId of testState.createdAccountIds) {
    try {
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

  // Reset test state
  testState.createdAccountIds.clear();
  testState.createdEmails.clear();
};

export const cleanupTestEnvironment = () => {
  // Clear React Testing Library state
  cleanup();

  // Reset Zustand store
  resetAppStore();

  // Clear all cookies
  clearAllCookies();

  // Clear any localStorage/sessionStorage if used
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }

  // Reset URL to clean state
  if (typeof window !== 'undefined' && window.history) {
    window.history.replaceState({}, '', window.location.pathname);
  }
};

// Integration test hooks
beforeAll(async () => {
  console.log('Starting integration tests...');
  console.log('Server URL:', INTEGRATION_CONFIG.SERVER_URL);

  cleanupTestEnvironment();

  // Check server availability and initialize mock service
  testState.serverHealthy = await checkServerAvailability();

  if (!testState.serverHealthy) {
    console.warn('Warning: Server not available. Some tests may fail.');
  } else {
    console.log('Mock service initialized successfully');
  }
}, INTEGRATION_CONFIG.LONG_TIMEOUT);

beforeEach(() => {
  // Reset any global state before each test
  cleanupTestEnvironment();
});

afterEach(async () => {
  // Clean up after each test
  cleanupTestEnvironment();
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

// Wait for email to be sent using mock service
export const waitForEmail = async (email: string, template?: string, timeout = 10000): Promise<any> => {
  if (!testState.mockService) {
    throw new Error('Mock service not initialized. Cannot wait for email.');
  }

  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const response = await testState.mockService.getLatestEmail(email, { template });
      if (response.email) {
        return response.email;
      }
    } catch (error) {
      // Email not found yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Email not received within ${timeout}ms for ${email}`);
};

// Extract verification token from email HTML content
export const extractVerificationToken = (emailHtml: string): string | null => {
  const tokenMatch = emailHtml.match(/token=([^&"\s]+)/);
  return tokenMatch ? tokenMatch[1] : null;
};

// Extract profile token from email HTML content
export const extractProfileToken = (emailHtml: string): string | null => {
  const tokenMatch = emailHtml.match(/profileToken=([^&"\s]+)/);
  return tokenMatch ? tokenMatch[1] : null;
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

// Export mock service instance for direct access in tests
export const getMockService = (): MockService => {
  if (!testState.mockService) {
    throw new Error('Mock service not initialized.');
  }
  return testState.mockService;
};
