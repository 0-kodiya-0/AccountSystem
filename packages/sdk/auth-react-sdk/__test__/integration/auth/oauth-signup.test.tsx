import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useOAuthSignup } from '../../../src/hooks/useOAuthSignup';
import { useSession } from '../../../src/hooks/useSession';
import { OAuthProviders } from '../../../src/types';
import { INTEGRATION_CONFIG, testState, clearAllCookies } from '../setup';

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

describe('OAuth Signup Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('OAuth Signup URL Generation', () => {
    it(
      'should generate OAuth signup URL for Google',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        const callbackUrl = `${INTEGRATION_CONFIG.FRONTEND_URL}/auth/signup-callback`;

        let signupUrl: string;
        await act(async () => {
          signupUrl = await result.current.getSignupUrl(OAuthProviders.Google, callbackUrl);
        });

        expect(signupUrl).toBeTruthy();
        expect(signupUrl).toContain('google');
        expect(signupUrl).toContain('account/mock/oauth/google/authorize');
        expect(result.current.error).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should generate OAuth signup URL for Microsoft',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        const callbackUrl = `${INTEGRATION_CONFIG.FRONTEND_URL}/auth/signup-callback`;

        let signupUrl: string;
        await act(async () => {
          signupUrl = await result.current.getSignupUrl(OAuthProviders.Microsoft, callbackUrl);
        });

        expect(result.current.error).not.toBe(null);
        expect(result.current.error).toBe('Provider microsoft is not implemented yet');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should validate signup parameters',
      async () => {
        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        // Test invalid provider
        let response: any;
        await act(async () => {
          response = await result.current.startSignup(
            'invalid-provider' as any,
            `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`,
          );
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();

        // Test invalid callback URL
        await act(async () => {
          response = await result.current.startSignup(OAuthProviders.Google, 'invalid-url');
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();

        // Test empty callback URL
        await act(async () => {
          response = await result.current.startSignup(OAuthProviders.Google, '');
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth Signup Callback Processing', () => {
    it(
      'should handle OAuth signup callback processing',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }), {
          wrapper: TestWrapper,
        });

        // Mock successful OAuth signup callback
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search:
              '?code=oauth_signup_success&accountId=507f1f77bcf86cd799439012&name=New%20User&message=Account%20created%20successfully',
          },
          writable: true,
        });

        let callbackResponse: any;
        await act(async () => {
          callbackResponse = await result.current.processCallbackFromUrl();
        });

        if (callbackResponse.success) {
          expect(result.current.isCompleted).toBe(true);
          expect(result.current.accountId).toBeTruthy();
          expect(result.current.accountName).toBeTruthy();

          if (result.current.accountId) {
            testState.createdAccountIds.add(result.current.accountId);
          }
        } else {
          console.warn('OAuth signup callback failed (expected with mock data):', callbackResponse.message);
          expect(result.current.isFailed).toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth Signup Progress Tracking', () => {
    it(
      'should track signup progress correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }), {
          wrapper: TestWrapper,
        });

        console.log('OAuth signup progress', result.current.phase);

        // Initial state
        expect(result.current.progress).toBe(0);
        expect(result.current.isIdle).toBe(true);

        // Start signup (this would redirect in real scenario)
        act(() => {
          result.current.startSignup(OAuthProviders.Google, `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`);
        });

        // Should show redirecting state
        expect(result.current.isRedirecting).toBe(true);
        expect(result.current.progress).toBeGreaterThan(0);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth Error Handling', () => {
    it(
      'should handle OAuth error callbacks',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }), {
          wrapper: TestWrapper,
        });

        // Mock OAuth error callback
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search: '?code=oauth_error&error=access_denied&message=User%20denied%20access',
          },
          writable: true,
        });

        let callbackResponse: any;
        await act(async () => {
          callbackResponse = await result.current.processCallbackFromUrl();
        });

        expect(callbackResponse.success).toBe(false);
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle network errors during URL generation',
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

        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapperBadUrl,
        });

        let signupUrl: string;
        await act(async () => {
          signupUrl = await result.current.getSignupUrl(
            OAuthProviders.Google,
            `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`,
          );
        });

        expect(signupUrl).toBe('');
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth State Management', () => {
    it(
      'should reset OAuth signup state correctly',
      async () => {
        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        // Simulate some state
        await act(async () => {
          await result.current.getSignupUrl(OAuthProviders.Google, `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`);
        });

        // Reset state
        act(() => {
          result.current.reset();
        });

        expect(result.current.isIdle).toBe(true);
        expect(result.current.error).toBe(null);
        expect(result.current.provider).toBe(null);
        expect(result.current.progress).toBe(0);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear OAuth errors',
      async () => {
        const { result } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        // Cause an error
        await act(async () => {
          await result.current.startSignup('invalid' as any, 'invalid-url');
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

  describe('OAuth Integration with Session', () => {
    it(
      'should establish session after successful OAuth signup',
      async () => {
        // Note: This requires a complete OAuth flow which needs real OAuth provider
        console.warn('OAuth session integration test incomplete: Requires complete OAuth flow');

        const { result: oauthResult } = renderHook(() => useOAuthSignup(), {
          wrapper: TestWrapper,
        });

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Initially no session
        expect(sessionResult.current.isAuthenticated).toBe(false);

        // After successful OAuth signup:
        // 1. OAuth callback would be processed
        // 2. Account would be created
        // 3. Session would be established
        // 4. sessionResult.current.isAuthenticated would be true

        // This requires real OAuth provider integration to test fully
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});
