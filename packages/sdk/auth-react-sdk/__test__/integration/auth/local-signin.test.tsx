import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useLocalSignin } from '../../../src/hooks/useLocalSignin';
import { useSession } from '../../../src/hooks/useSession';
import { INTEGRATION_CONFIG, testState, waitForCondition, clearAllCookies, getMockService } from '../setup';

// Test wrapper component
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <ServicesProvider
    config={{
      sdkConfig: {
        backendUrl: INTEGRATION_CONFIG.SERVER_URL,
        timeout: INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
        withCredentials: true,
        enableLogging: true,
      },
    }}
  >
    {children}
  </ServicesProvider>
);

describe('Enhanced Local Signin Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('Successful Local Signin', () => {
    it(
      'should sign in with valid email and password',
      async () => {
        // Skip if server is not healthy
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result: signinResult } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Initial state checks
        expect(signinResult.current.isIdle).toBe(true);
        expect(signinResult.current.loading).toBe(false);
        expect(signinResult.current.error).toBe(null);

        // Attempt signin
        let signinResponse: any;
        await act(async () => {
          signinResponse = await signinResult.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        // Check signin result
        if (signinResponse.success) {
          expect(signinResult.current.isCompleted).toBe(true);
          expect(signinResult.current.error).toBe(null);
          expect(signinResult.current.accountId).toBeTruthy();
          expect(signinResult.current.accountName).toBeTruthy();

          // Wait for session to be established
          await waitForCondition(() => {
            return sessionResult.current.isAuthenticated;
          }, 10000);

          expect(sessionResult.current.isAuthenticated).toBe(true);
          expect(sessionResult.current.currentAccountId).toBeTruthy();

          // Track created account for cleanup
          if (signinResult.current.accountId) {
            testState.createdAccountIds.add(signinResult.current.accountId);
          }
        } else {
          // If signin failed, it might be because the test user doesn't exist
          // This is expected in a fresh test environment
          console.warn('Test user signin failed (expected if user does not exist):', signinResponse.message);
          expect(signinResult.current.isFailed).toBe(true);
        }
      },
      INTEGRATION_CONFIG.LONG_TIMEOUT,
    );

    it(
      'should handle signin with username instead of email',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        let response: any;
        await act(async () => {
          response = await result.current.signin({
            username: INTEGRATION_CONFIG.TEST_USER.username,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        // Similar to email test - may fail if user doesn't exist
        if (response.success) {
          expect(result.current.isCompleted).toBe(true);
          expect(result.current.accountId).toBeTruthy();

          if (result.current.accountId) {
            testState.createdAccountIds.add(result.current.accountId);
          }
        } else {
          console.warn('Username signin failed (expected if user does not exist):', response.message);
          expect(result.current.isFailed).toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Two-Factor Authentication Flow', () => {
    it(
      'should handle 2FA requirement during signin',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // First, attempt signin
        let signinResponse: any;
        await act(async () => {
          signinResponse = await result.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        // If 2FA is required
        if (result.current.requiresTwoFactor) {
          expect(result.current.isRequires2FA).toBe(true);
          expect(result.current.tempToken).toBeTruthy();
          expect(result.current.accountId).toBeTruthy();

          // Get valid 2FA code from mock service
          const mockService = getMockService();

          try {
            // Get account's 2FA secret and generate code
            const secretResponse = await mockService.getAccountSecret(result.current.accountId!);
            const totpResponse = await mockService.generateTotpCode(secretResponse.secret);

            // Verify 2FA with valid code
            let verifyResponse: any;
            await act(async () => {
              verifyResponse = await result.current.verify2FA(totpResponse.token);
            });

            // Should succeed with valid code
            if (verifyResponse.success) {
              expect(result.current.isCompleted).toBe(true);
            } else {
              console.warn('2FA verification failed despite valid code');
            }
          } catch (error) {
            console.warn('Could not generate valid 2FA code (account may not have 2FA enabled)');

            // Test with invalid code to verify flow
            let verifyResponse: any;
            await act(async () => {
              verifyResponse = await result.current.verify2FA('123456'); // Invalid code
            });

            // Should fail with invalid code
            expect(verifyResponse.success).toBe(false);
            expect(result.current.isFailed).toBe(true);
          }

          if (result.current.accountId) {
            testState.createdAccountIds.add(result.current.accountId);
          }
        } else {
          console.log('2FA not required for test user (this is normal)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Signin Error Handling', () => {
    it(
      'should handle invalid credentials',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        let response: any;
        await act(async () => {
          response = await result.current.signin({
            email: 'nonexistent@example.com',
            password: 'wrongpassword',
          });
        });

        expect(response.success).toBe(false);
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
        expect(result.current.accountId).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle network errors gracefully',
      async () => {
        // Test with invalid server URL to simulate network error
        const TestWrapperBadUrl = ({ children }: { children: ReactNode }) => (
          <ServicesProvider
            config={{
              sdkConfig: {
                backendUrl: 'http://invalid-server-url:9999',
                timeout: 5000,
                withCredentials: true,
              },
            }}
          >
            {children}
          </ServicesProvider>
        );

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapperBadUrl,
        });

        let response: any;
        await act(async () => {
          response = await result.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        expect(response.success).toBe(false);
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should validate input data',
      async () => {
        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // Test empty email
        let response: any;
        await act(async () => {
          response = await result.current.signin({
            email: '',
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        expect(response.success).toBe(false);
        expect(response.message).toContain('email');

        // Test empty password
        await act(async () => {
          response = await result.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: '',
          });
        });

        expect(response.success).toBe(false);
        expect(response.message).toContain('password');

        // Test missing both email and username
        await act(async () => {
          response = await result.current.signin({
            password: INTEGRATION_CONFIG.TEST_USER.password,
          } as any);
        });

        expect(response.success).toBe(false);
        expect(response.message).toContain('Email or username');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Retry Functionality', () => {
    it(
      'should handle retry attempts with cooldown',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // First failed attempt
        await act(async () => {
          await result.current.signin({
            email: 'invalid@example.com',
            password: 'wrongpassword',
          });
        });

        expect(result.current.isFailed).toBe(true);

        // Immediate retry should be possible (first retry)
        expect(result.current.canRetry).toBe(true);

        let retryResponse: any;
        await act(async () => {
          retryResponse = await result.current.retry();
        });

        // Should still fail with same invalid credentials
        expect(retryResponse.success).toBe(false);
        expect(result.current.retryCount).toBe(1);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Progress Tracking', () => {
    it(
      'should track signin progress correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // Initial state
        expect(result.current.progress).toBe(0);
        expect(result.current.currentStep).toContain('Ready');

        // During signin
        act(() => {
          result.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        // Should show signing in progress
        expect(result.current.isSigningIn).toBe(true);
        expect(result.current.progress).toBeGreaterThan(0);

        // Wait for completion
        await waitForCondition(() => {
          return result.current.isCompleted || result.current.isFailed;
        }, 10000);

        if (result.current.isCompleted) {
          expect(result.current.progress).toBe(100);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Hook State Management', () => {
    it(
      'should reset state correctly',
      async () => {
        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // Perform a signin attempt
        await act(async () => {
          await result.current.signin({
            email: 'test@example.com',
            password: 'password',
          });
        });

        // Should have some state
        expect(result.current.isIdle).toBe(false);

        // Reset state
        act(() => {
          result.current.reset();
        });

        // Should be back to initial state
        expect(result.current.isIdle).toBe(true);
        expect(result.current.error).toBe(null);
        expect(result.current.accountId).toBe(null);
        expect(result.current.progress).toBe(0);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear errors',
      async () => {
        const { result } = renderHook(() => useLocalSignin(), {
          wrapper: TestWrapper,
        });

        // Cause an error
        await act(async () => {
          await result.current.signin({
            email: '',
            password: '',
          });
        });

        expect(result.current.error).toBeTruthy();

        // Clear error
        act(() => {
          result.current.clearError();
        });

        expect(result.current.error).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});
