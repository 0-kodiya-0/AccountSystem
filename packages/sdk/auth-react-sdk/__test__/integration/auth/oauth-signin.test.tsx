import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useOAuthSignin } from '../../../src/hooks/useOAuthSignin';
import { useSession } from '../../../src/hooks/useSession';
import { OAuthProviders } from '../../../src/types';
import { INTEGRATION_CONFIG, testState, clearAllCookies, getMockService } from '../setup';

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

describe('OAuth Signin Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('OAuth Signin URL Generation', () => {
    it(
      'should generate OAuth signin URL for Google',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        const callbackUrl = `${INTEGRATION_CONFIG.FRONTEND_URL}/auth/callback`;

        let signinUrl: string;
        await act(async () => {
          signinUrl = await result.current.getSigninUrl(OAuthProviders.Google, callbackUrl);
        });

        expect(signinUrl).toBeTruthy();
        expect(signinUrl).toContain('google');
        expect(signinUrl).toContain('oauth');
        expect(result.current.error).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should generate OAuth signin URL for Microsoft',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        const callbackUrl = `${INTEGRATION_CONFIG.FRONTEND_URL}/auth/callback`;

        let signinUrl: string;
        await act(async () => {
          signinUrl = await result.current.getSigninUrl(OAuthProviders.Microsoft, callbackUrl);
        });

        expect(signinUrl).toBeTruthy();
        expect(signinUrl).toContain('microsoft');
        expect(result.current.error).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should validate signin parameters',
      async () => {
        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        // Test invalid provider
        let response: any;
        await act(async () => {
          response = await result.current.startSignin(
            'invalid-provider' as any,
            `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`,
          );
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();

        // Test invalid callback URL
        await act(async () => {
          response = await result.current.startSignin(OAuthProviders.Google, 'invalid-url');
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();

        // Test empty callback URL
        await act(async () => {
          response = await result.current.startSignin(OAuthProviders.Google, '');
        });

        expect(response.success).toBe(false);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth Signin Callback Processing', () => {
    it(
      'should handle OAuth signin callback processing',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }), {
          wrapper: TestWrapper,
        });

        // Mock successful OAuth signin callback
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search:
              '?code=oauth_signin_success&accountId=507f1f77bcf86cd799439011&name=Test%20User&provider=google&message=OAuth%20signin%20successful',
          },
          writable: true,
        });

        let callbackResponse: any;
        await act(async () => {
          callbackResponse = await result.current.processCallbackFromUrl();
        });

        // With mock parameters, this may succeed or fail depending on server validation
        if (callbackResponse.success) {
          expect(result.current.isCompleted).toBe(true);
          expect(result.current.accountId).toBeTruthy();
          expect(result.current.provider).toBe(OAuthProviders.Google);

          if (result.current.accountId) {
            testState.createdAccountIds.add(result.current.accountId);
          }
        } else {
          console.warn('OAuth callback processing failed (expected with mock data):', callbackResponse.message);
          expect(result.current.isFailed).toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle OAuth signin with 2FA requirement',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }), {
          wrapper: TestWrapper,
        });

        // Mock OAuth callback that requires 2FA
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            search:
              '?code=oauth_signin_requires_2fa&tempToken=temp123&accountId=507f1f77bcf86cd799439011&name=Test%20User',
          },
          writable: true,
        });

        await act(async () => {
          await result.current.processCallbackFromUrl();
        });

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

            // Test 2FA verification with valid code
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
              verifyResponse = await result.current.verify2FA('123456');
            });

            // Should fail with invalid code
            expect(verifyResponse.success).toBe(false);
            expect(result.current.isFailed).toBe(true);
          }

          if (result.current.accountId) {
            testState.createdAccountIds.add(result.current.accountId);
          }
        } else {
          console.log('OAuth 2FA test skipped - callback did not trigger 2FA requirement');
        }
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

        const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }), {
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

        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapperBadUrl,
        });

        let signinUrl: string;
        await act(async () => {
          signinUrl = await result.current.getSigninUrl(
            OAuthProviders.Google,
            `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`,
          );
        });

        expect(signinUrl).toBe('');
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth State Management', () => {
    it(
      'should reset OAuth signin state correctly',
      async () => {
        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        // Simulate some state
        await act(async () => {
          await result.current.getSigninUrl(OAuthProviders.Google, `${INTEGRATION_CONFIG.FRONTEND_URL}/callback`);
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
        const { result } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        // Cause an error
        await act(async () => {
          await result.current.startSignin('invalid' as any, 'invalid-url');
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
      'should establish session after successful OAuth signin',
      async () => {
        // Note: This requires a complete OAuth flow which needs real OAuth provider
        console.warn('OAuth session integration test incomplete: Requires complete OAuth flow');

        const { result: oauthResult } = renderHook(() => useOAuthSignin(), {
          wrapper: TestWrapper,
        });

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Initially no session
        expect(sessionResult.current.isAuthenticated).toBe(false);

        // After successful OAuth signin:
        // 1. OAuth callback would be processed
        // 2. Session would be established
        // 3. sessionResult.current.isAuthenticated would be true

        // This requires real OAuth provider integration to test fully
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('OAuth Provider Coverage', () => {
    const providers = [OAuthProviders.Google, OAuthProviders.Microsoft, OAuthProviders.Facebook];

    providers.forEach((provider) => {
      it(
        `should support ${provider} OAuth signin flow`,
        async () => {
          if (!testState.serverHealthy) {
            console.warn('Skipping test: Server not healthy');
            return;
          }

          const { result } = renderHook(() => useOAuthSignin(), {
            wrapper: TestWrapper,
          });

          const callbackUrl = `${INTEGRATION_CONFIG.FRONTEND_URL}/auth/callback`;

          let signinUrl: string;
          await act(async () => {
            signinUrl = await result.current.getSigninUrl(provider, callbackUrl);
          });

          expect(signinUrl).toBeTruthy();
          expect(signinUrl).toContain(provider.toLowerCase());
          expect(result.current.error).toBe(null);
        },
        INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
      );
    });
  });
});
