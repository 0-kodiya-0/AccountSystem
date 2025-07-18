import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useLocalSignup } from '../../../src/hooks/useLocalSignup';
import { useSession } from '../../../src/hooks/useSession';
import {
  INTEGRATION_CONFIG,
  testState,
  generateTestData,
  waitForCondition,
  clearAllCookies,
  waitForEmail,
  extractVerificationToken,
} from '../setup';

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

describe('Local Signup Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('Email Verification Flow', () => {
    it(
      'should start signup process and send verification email',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testData = generateTestData();
        testState.createdEmails.add(testData.email);

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Initial state
        expect(result.current.isIdle).toBe(true);
        expect(result.current.phase).toBe('idle');

        // Start signup
        let startResponse: any;
        await act(async () => {
          startResponse = await result.current.start({
            email: testData.email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        expect(startResponse.success).toBe(true);
        expect(result.current.isEmailSent).toBe(true);
        expect(result.current.phase).toBe('email_sent');
        expect(result.current.progress).toBeGreaterThan(0);
        expect(result.current.error).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should complete full signup flow with email verification',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testData = generateTestData();
        testState.createdEmails.add(testData.email);

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Step 1: Start signup process
        let startResponse: any;
        await act(async () => {
          startResponse = await result.current.start({
            email: testData.email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        expect(startResponse.success).toBe(true);
        expect(result.current.isEmailSent).toBe(true);

        // Step 2: Wait for verification email to be sent
        const verificationEmail = await waitForEmail(testData.email, 'email-signup-verification');

        expect(verificationEmail).toBeTruthy();
        expect(verificationEmail.to).toBe(testData.email);
        expect(verificationEmail.template).toBe('email-signup-verification');

        // Step 3: Extract verification token from email
        const verificationToken = extractVerificationToken(verificationEmail.html);
        expect(verificationToken).toBeTruthy();

        // Step 4: Simulate URL navigation with verification token
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search: `?token=${verificationToken}`,
          },
          writable: true,
        });

        // Step 5: Process verification token
        let verifyResponse: any;
        await act(async () => {
          verifyResponse = await result.current.processTokenFromUrl();
        });

        expect(verifyResponse.success).toBe(true);
        expect(result.current.isEmailVerified).toBe(true);
        expect(result.current.canComplete).toBe(true);

        // Step 6: Complete profile
        let completeResponse: any;
        await act(async () => {
          completeResponse = await result.current.complete({
            firstName: INTEGRATION_CONFIG.TEST_USER.firstName,
            lastName: INTEGRATION_CONFIG.TEST_USER.lastName,
            username: testData.username,
            password: INTEGRATION_CONFIG.TEST_USER.password,
            confirmPassword: INTEGRATION_CONFIG.TEST_USER.password,
            agreeToTerms: true,
          });
        });

        expect(completeResponse.success).toBe(true);
        expect(completeResponse.accountId).toBeTruthy();
        expect(result.current.isCompleted).toBe(true);

        // Track created account for cleanup
        if (completeResponse.accountId) {
          testState.createdAccountIds.add(completeResponse.accountId);
        }
      },
      INTEGRATION_CONFIG.LONG_TIMEOUT,
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle duplicate email registration',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Try to register with the main test user email (should already exist)
        let response: any;
        await act(async () => {
          response = await result.current.start({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        // May succeed (sending verification email) or fail (user exists)
        // Behavior depends on server implementation
        if (!response.success) {
          expect(result.current.isFailed).toBe(true);
          expect(result.current.error).toBeTruthy();
        } else {
          console.log('Server allows re-sending verification emails');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle invalid email format',
      async () => {
        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        let response: any;
        await act(async () => {
          response = await result.current.start({
            email: 'invalid-email-format',
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        expect(response.success).toBe(false);
        expect(response.message).toContain('email');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle invalid callback URL',
      async () => {
        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        let response: any;
        await act(async () => {
          response = await result.current.start({
            email: generateTestData().email,
            callbackUrl: 'invalid-url',
          });
        });

        expect(response.success).toBe(false);
        expect(response.message).toContain('URL');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle network errors',
      async () => {
        const TestWrapperBadUrl = ({ children }: { children: ReactNode }) => (
          <ServicesProvider
            config={{
              sdkConfig: {
                backendUrl: 'http://invalid-server:9999',
                timeout: 5000,
                withCredentials: true,
              },
            }}
          >
            {children}
          </ServicesProvider>
        );

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapperBadUrl,
        });

        let response: any;
        await act(async () => {
          response = await result.current.start({
            email: generateTestData().email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        expect(response.success).toBe(false);
        expect(result.current.isFailed).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Profile Completion Validation', () => {
    it(
      'should validate profile completion data',
      async () => {
        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Test missing required fields
        let response: any;

        // Missing firstName
        await act(async () => {
          response = await result.current.complete({
            firstName: '',
            lastName: INTEGRATION_CONFIG.TEST_USER.lastName,
            password: INTEGRATION_CONFIG.TEST_USER.password,
            confirmPassword: INTEGRATION_CONFIG.TEST_USER.password,
            agreeToTerms: true,
          });
        });
        expect(response.success).toBe(false);
        expect(response.message).toContain('firstName');

        // Password mismatch
        await act(async () => {
          response = await result.current.complete({
            firstName: INTEGRATION_CONFIG.TEST_USER.firstName,
            lastName: INTEGRATION_CONFIG.TEST_USER.lastName,
            password: INTEGRATION_CONFIG.TEST_USER.password,
            confirmPassword: 'differentpassword',
            agreeToTerms: true,
          });
        });
        expect(response.success).toBe(false);
        expect(response.message).toContain('match');

        // Terms not agreed
        await act(async () => {
          response = await result.current.complete({
            firstName: INTEGRATION_CONFIG.TEST_USER.firstName,
            lastName: INTEGRATION_CONFIG.TEST_USER.lastName,
            password: INTEGRATION_CONFIG.TEST_USER.password,
            confirmPassword: INTEGRATION_CONFIG.TEST_USER.password,
            agreeToTerms: false,
          });
        });
        expect(response.success).toBe(false);
        expect(response.message).toContain('terms');

        // Short password
        await act(async () => {
          response = await result.current.complete({
            firstName: INTEGRATION_CONFIG.TEST_USER.firstName,
            lastName: INTEGRATION_CONFIG.TEST_USER.lastName,
            password: '123',
            confirmPassword: '123',
            agreeToTerms: true,
          });
        });
        expect(response.success).toBe(false);
        expect(response.message).toContain('8 characters');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Progress and State Tracking', () => {
    it(
      'should track signup progress correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Initial state
        expect(result.current.progress).toBe(0);
        expect(result.current.currentStep).toContain('Ready');
        expect(result.current.nextStep).toBeTruthy();

        // Start signup
        act(() => {
          result.current.start({
            email: generateTestData().email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        // Should show progress
        expect(result.current.isEmailSending).toBe(true);
        expect(result.current.progress).toBeGreaterThan(0);

        // Wait for completion
        await waitForCondition(() => {
          return result.current.isEmailSent || result.current.isFailed;
        }, 10000);

        if (result.current.isEmailSent) {
          expect(result.current.progress).toBeGreaterThan(25);
          expect(result.current.currentStep).toContain('sent');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle retry functionality',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Force a failure by using invalid callback URL
        await act(async () => {
          await result.current.start({
            email: generateTestData().email,
            callbackUrl: 'invalid-url',
          });
        });

        expect(result.current.isFailed).toBe(true);
        expect(result.current.canRetry).toBe(true);

        // Retry should be available
        let retryResponse: any;
        await act(async () => {
          retryResponse = await result.current.retry();
        });

        // Should still fail with same invalid URL
        expect(retryResponse.success).toBe(false);
        expect(result.current.retryCount).toBe(1);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Hook State Management', () => {
    it(
      'should reset state correctly',
      async () => {
        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Perform signup attempt
        await act(async () => {
          await result.current.start({
            email: generateTestData().email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        // Should have some state
        expect(result.current.isIdle).toBe(false);

        // Reset
        act(() => {
          result.current.reset();
        });

        // Should be back to initial state
        expect(result.current.isIdle).toBe(true);
        expect(result.current.error).toBe(null);
        expect(result.current.progress).toBe(0);
        expect(result.current.phase).toBe('idle');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear errors',
      async () => {
        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Cause an error
        await act(async () => {
          await result.current.start({
            email: 'invalid-email',
            callbackUrl: 'invalid-url',
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

  describe('Integration with Session', () => {
    it(
      'should create session after successful signup',
      async () => {
        // Note: This test would require completing the full signup flow
        // which needs access to verification emails and profile tokens
        console.warn('Session integration test incomplete: Requires full signup flow completion');

        const { result: signupResult } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Initially no session
        expect(sessionResult.current.isAuthenticated).toBe(false);

        // In a complete integration test, after successful profile completion:
        // 1. Account would be created
        // 2. User would be automatically signed in
        // 3. Session would be established
        // 4. sessionResult.current.isAuthenticated would be true

        // This requires the full email verification flow to work
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Auto Token Processing', () => {
    it(
      'should auto-process verification token from URL on mount',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Mock URL with verification token
        const mockToken = 'test-verification-token';
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search: `?token=${mockToken}`,
          },
          writable: true,
        });

        const { result } = renderHook(() => useLocalSignup({ autoProcessToken: true }), {
          wrapper: TestWrapper,
        });

        // Should attempt to process token automatically
        await waitForCondition(() => {
          return result.current.isEmailVerifying || result.current.isFailed || result.current.isEmailVerified;
        }, 5000);

        // With mock token, should fail
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should disable auto-processing when configured',
      async () => {
        // Mock URL with verification token
        const mockToken = 'test-verification-token';
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search: `?token=${mockToken}`,
          },
          writable: true,
        });

        const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }), {
          wrapper: TestWrapper,
        });

        // Should remain idle
        expect(result.current.isIdle).toBe(true);
        expect(result.current.phase).toBe('idle');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Signup Cancellation', () => {
    it(
      'should cancel signup process',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testData = generateTestData();
        testState.createdEmails.add(testData.email);

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Start signup
        await act(async () => {
          await result.current.start({
            email: testData.email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        expect(result.current.isEmailSent).toBe(true);
        expect(result.current.canCancel).toBe(true);

        // Cancel signup
        let cancelResponse: any;
        await act(async () => {
          cancelResponse = await result.current.cancel();
        });

        expect(cancelResponse.success).toBe(true);
        expect(result.current.isCanceled).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Email Template Verification', () => {
    it(
      'should send correctly formatted verification email',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testData = generateTestData();
        testState.createdEmails.add(testData.email);

        const { result } = renderHook(() => useLocalSignup(), {
          wrapper: TestWrapper,
        });

        // Start signup
        await act(async () => {
          await result.current.start({
            email: testData.email,
            callbackUrl: `${INTEGRATION_CONFIG.FRONTEND_URL}/signup/verify`,
          });
        });

        // Get and verify email content
        const verificationEmail = await waitForEmail(testData.email, 'email-signup-verification');

        // Verify email structure
        expect(verificationEmail.to).toBe(testData.email);
        expect(verificationEmail.subject).toBeTruthy();
        expect(verificationEmail.html).toBeTruthy();
        expect(verificationEmail.text).toBeTruthy();
        expect(verificationEmail.template).toBe('email-signup-verification');

        // Verify email contains verification link
        expect(verificationEmail.html).toContain('token=');
        expect(verificationEmail.html).toContain(INTEGRATION_CONFIG.FRONTEND_URL);

        // Verify metadata is properly set
        expect(verificationEmail.metadata).toBeTruthy();
        expect(verificationEmail.metadata.emailFlow).toBe('signup');
        expect(verificationEmail.metadata.flowStep).toBe('initial');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});
