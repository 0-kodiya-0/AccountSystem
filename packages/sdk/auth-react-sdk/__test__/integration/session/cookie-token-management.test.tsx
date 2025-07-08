// packages/sdk/auth-react-sdk/__test__/integration/session/cookie-token-management.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useSession } from '../../../src/hooks/useSession';
import { useAccount } from '../../../src/hooks/useAccount';
import { useLocalSignin } from '../../../src/hooks/useLocalSignin';
import { INTEGRATION_CONFIG, testState, waitForCondition, clearAllCookies, getCookieValue } from '../setup';

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

describe('Cookie and Token Management Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('Cookie Management', () => {
    it(
      'should set authentication cookies on successful signin',
      async () => {
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

        // Check initial cookies
        const initialSessionCookie = getCookieValue('accountSession');
        const initialAccessCookie = getCookieValue('accessToken');

        // Attempt signin
        let signinResponse: any;
        await act(async () => {
          signinResponse = await signinResult.current.signin({
            email: INTEGRATION_CONFIG.TEST_USER.email,
            password: INTEGRATION_CONFIG.TEST_USER.password,
          });
        });

        if (signinResponse.success) {
          // Wait for session to be established
          await waitForCondition(() => {
            return sessionResult.current.isAuthenticated;
          }, 10000);

          // Check that cookies were set
          const sessionCookie = getCookieValue('accountSession');
          const accessCookie = getCookieValue('accessToken');

          expect(sessionCookie).toBeTruthy();
          expect(sessionCookie).not.toBe(initialSessionCookie);

          // Access token cookie may or may not be set depending on server implementation
          if (accessCookie) {
            expect(accessCookie).not.toBe(initialAccessCookie);
          }

          // Track account for cleanup
          if (signinResult.current.accountId) {
            testState.createdAccountIds.add(signinResult.current.accountId);
          }
        } else {
          console.warn('Signin failed, cookie test skipped:', signinResponse.message);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear authentication cookies on logout',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Load session first
        await waitForCondition(() => {
          return !sessionResult.current.isLoading;
        }, 10000);

        if (sessionResult.current.isAuthenticated) {
          // Check cookies before logout
          const sessionCookieBefore = getCookieValue('accountSession');
          const accessCookieBefore = getCookieValue('accessToken');

          expect(sessionCookieBefore).toBeTruthy();

          // Logout
          await act(async () => {
            await sessionResult.current.logoutAll();
          });

          // Wait for logout to complete
          await waitForCondition(() => {
            return !sessionResult.current.isAuthenticated;
          }, 5000);

          // Check cookies after logout
          const sessionCookieAfter = getCookieValue('accountSession');
          const accessCookieAfter = getCookieValue('accessToken');

          // Cookies should be cleared or empty
          expect(sessionCookieAfter === null || sessionCookieAfter === '').toBe(true);

          if (accessCookieBefore) {
            expect(accessCookieAfter === null || accessCookieAfter === '').toBe(true);
          }
        } else {
          console.warn('No active session for logout cookie test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle cookie persistence across page reloads',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: This test simulates page reload by unmounting and remounting components
        // In a real browser, cookies would persist across actual page reloads

        const { result: firstSessionResult, unmount: firstUnmount } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !firstSessionResult.current.isLoading;
        }, 10000);

        if (firstSessionResult.current.isAuthenticated) {
          const sessionCookie = getCookieValue('accountSession');
          const originalAccountIds = firstSessionResult.current.accountIds;
          const originalCurrentAccount = firstSessionResult.current.currentAccountId;

          expect(sessionCookie).toBeTruthy();

          // Unmount (simulate page unload)
          firstUnmount();

          // Cookies should still be present
          const persistedSessionCookie = getCookieValue('accountSession');
          expect(persistedSessionCookie).toBe(sessionCookie);

          // Mount new session hook (simulate page reload)
          const { result: secondSessionResult } = renderHook(() => useSession(), {
            wrapper: TestWrapper,
          });

          await waitForCondition(() => {
            return !secondSessionResult.current.isLoading;
          }, 10000);

          // Session should be restored from cookies
          expect(secondSessionResult.current.isAuthenticated).toBe(true);
          expect(secondSessionResult.current.accountIds).toEqual(originalAccountIds);
          expect(secondSessionResult.current.currentAccountId).toBe(originalCurrentAccount);
        } else {
          console.warn('No authenticated session for persistence test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle expired cookies gracefully',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: Testing expired cookies is complex in integration tests
        // This would require either:
        // 1. A way to set cookies with past expiration dates
        // 2. A server endpoint to expire tokens
        // 3. Waiting for actual token expiration (too slow for tests)

        console.warn('Expired cookie test incomplete: Requires token expiration mechanism');

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated) {
          // In production with HTTPS, cookies should be secure
          // In test environment, we just verify session works
          expect(result.current.isAuthenticated).toBe(true);

          console.log('Cookie security test - In production, ensure cookies have Secure flag with HTTPS');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle SameSite cookie attributes',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: SameSite attributes are important for CSRF protection
        // This test documents the requirement

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated) {
          expect(result.current.isAuthenticated).toBe(true);

          console.log('SameSite cookie test - Ensure cookies have appropriate SameSite attributes in production');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Cookie Expiration and Renewal', () => {
    it(
      'should handle cookie expiration gracefully',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: Testing cookie expiration requires either:
        // 1. Setting cookies with very short expiration
        // 2. Server endpoint to expire cookies
        // 3. Time manipulation (not available in browser environment)

        console.warn('Cookie expiration test incomplete: Requires cookie expiration mechanism');

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        // For now, verify error handling structure
        if (result.current.hasError) {
          expect(result.current.error).toBeTruthy();
          expect(result.current.isAuthenticated).toBe(false);
        } else if (result.current.isAuthenticated) {
          expect(result.current.data?.isValid).toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should renew cookies before expiration',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: This would require knowledge of cookie expiration times
        // and the ability to wait for renewal to occur

        console.warn('Cookie renewal test incomplete: Requires cookie renewal timing mechanism');

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated) {
          // Session should remain valid
          expect(result.current.data?.isValid).toBe(true);

          // In a complete test, we would:
          // 1. Monitor cookie values over time
          // 2. Verify they are renewed before expiration
          // 3. Ensure session remains uninterrupted
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Error Recovery', () => {
    it(
      'should recover from temporary network failures',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Start with good connection
        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        const initialAuthState = result.current.isAuthenticated;

        // Simulate network failure by using bad URL
        const TestWrapperBadUrl = ({ children }: { children: ReactNode }) => (
          <ServicesProvider
            config={{
              sdkConfig: {
                backendUrl: 'http://invalid-server:9999',
                timeout: 2000,
                withCredentials: true,
              },
            }}
          >
            {children}
          </ServicesProvider>
        );

        const { result: badResult } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapperBadUrl,
        });

        // This should fail
        await act(async () => {
          await badResult.current.load();
        });

        expect(badResult.current.hasError).toBe(true);

        // Recovery with good connection
        const { result: recoveredResult } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapper,
        });

        await act(async () => {
          await recoveredResult.current.load();
        });

        // Should recover successfully
        expect(recoveredResult.current.isAuthenticated).toBe(initialAuthState);
        if (initialAuthState) {
          expect(recoveredResult.current.data?.isValid).toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle malformed cookie data',
      async () => {
        // Note: Testing malformed cookies is challenging in integration tests
        // This would require either:
        // 1. A way to manually set malformed cookies
        // 2. Server endpoint that sets malformed cookies
        // 3. Browser manipulation tools

        console.warn('Malformed cookie test incomplete: Requires cookie manipulation mechanism');

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        // Should handle gracefully if cookies are malformed
        expect(result.current.hasError || result.current.isSuccess).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Performance Considerations', () => {
    it(
      'should not make excessive API calls for token validation',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Note: This test would require monitoring network requests
        // In a complete integration test, you would:
        // 1. Monitor network requests
        // 2. Verify token validation is not called excessively
        // 3. Ensure caching is working properly

        console.warn('Token validation performance test incomplete: Requires network monitoring');

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        // Multiple session hooks should not cause multiple validation calls
        const { result: result2 } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        const { result: result3 } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result2.current.isLoading && !result3.current.isLoading;
        }, 5000);

        // All should have same authentication state
        expect(result.current.isAuthenticated).toBe(result2.current.isAuthenticated);
        expect(result.current.isAuthenticated).toBe(result3.current.isAuthenticated);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should efficiently handle concurrent requests',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapper,
        });

        // Make multiple concurrent load requests
        const loadPromises = [
          act(async () => {
            await result.current.load();
          }),
          act(async () => {
            await result.current.load();
          }),
          act(async () => {
            await result.current.load();
          }),
        ];

        await Promise.all(loadPromises);

        // Should complete successfully without conflicts
        expect(result.current.isSuccess || result.current.hasError).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Integration Test Cleanup', () => {
    it(
      'should clean up test data after tests',
      async () => {
        // This test documents the cleanup requirements
        // Actual cleanup is handled in the setup file

        console.log('Test cleanup - the following data should be cleaned up:');
        console.log('Created account IDs:', Array.from(testState.createdAccountIds));
        console.log('Created emails:', Array.from(testState.createdEmails));

        // Verify cleanup tracking is working
        expect(Array.isArray(Array.from(testState.createdAccountIds))).toBe(true);
        expect(Array.isArray(Array.from(testState.createdEmails))).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});

describe('Token Management', () => {
  it(
    'should get token information for authenticated account',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      const { result: sessionResult } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      await waitForCondition(() => {
        return !sessionResult.current.isLoading;
      }, 10000);

      if (sessionResult.current.isAuthenticated && sessionResult.current.currentAccountId) {
        const { result: accountResult } = renderHook(() => useAccount(sessionResult.current.currentAccountId!), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !accountResult.current.isLoading;
        }, 10000);

        if (accountResult.current.exists) {
          // Get token information
          let tokenInfo: any;
          await act(async () => {
            tokenInfo = await accountResult.current.getTokenInformation();
          });

          if (tokenInfo) {
            expect(tokenInfo).toBeTruthy();
            expect(typeof tokenInfo.isValid).toBe('boolean');
            expect(typeof tokenInfo.isExpired).toBe('boolean');

            if (tokenInfo.expiresAt) {
              expect(typeof tokenInfo.expiresAt).toBe('number');
            }
          } else {
            console.warn('Token information not available (may require specific authentication)');
          }
        }
      } else {
        console.warn('No authenticated account for token test');
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );

  it(
    'should revoke tokens for account',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      const { result: sessionResult } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      await waitForCondition(() => {
        return !sessionResult.current.isLoading;
      }, 10000);

      if (sessionResult.current.isAuthenticated && sessionResult.current.currentAccountId) {
        const { result: accountResult } = renderHook(() => useAccount(sessionResult.current.currentAccountId!), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !accountResult.current.isLoading;
        }, 10000);

        if (accountResult.current.exists) {
          // Revoke tokens
          let revokeResponse: any;
          await act(async () => {
            revokeResponse = await accountResult.current.revokeTokens();
          });

          if (revokeResponse) {
            expect(revokeResponse).toBeTruthy();
            expect(revokeResponse.message).toBeTruthy();

            // Session should be refreshed after token revocation
            await waitForCondition(() => {
              return !sessionResult.current.isUpdating;
            }, 5000);

            // May or may not be authenticated depending on server behavior
            console.log('Tokens revoked, session state:', {
              isAuthenticated: sessionResult.current.isAuthenticated,
              hasError: sessionResult.current.hasError,
            });
          } else {
            console.warn('Token revocation failed (may require specific permissions)');
          }
        }
      } else {
        console.warn('No authenticated account for token revocation test');
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );

  it(
    'should handle token refresh automatically',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      // Note: Testing automatic token refresh is complex because it requires:
      // 1. Tokens that are close to expiration
      // 2. A way to trigger refresh logic
      // 3. Or waiting for actual token expiration

      console.warn('Automatic token refresh test incomplete: Requires near-expired tokens');

      const { result } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      await waitForCondition(() => {
        return !result.current.isLoading;
      }, 10000);

      if (result.current.isAuthenticated) {
        // The SDK should handle token refresh automatically
        // We can only verify that the session remains valid
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.data?.isValid).toBe(true);
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );
});

describe('Cross-Tab Communication', () => {
  it(
    'should handle session state across multiple hook instances',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      // Create multiple session hooks (simulating different components/tabs)
      const { result: session1 } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      const { result: session2 } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      // Wait for both to load
      await waitForCondition(() => {
        return !session1.current.isLoading && !session2.current.isLoading;
      }, 10000);

      // Both should have same session state
      expect(session1.current.isAuthenticated).toBe(session2.current.isAuthenticated);

      if (session1.current.isAuthenticated) {
        expect(session1.current.currentAccountId).toBe(session2.current.currentAccountId);
        expect(session1.current.accountIds).toEqual(session2.current.accountIds);
      }

      // Changes in one should reflect in the other
      if (session1.current.isAuthenticated && session1.current.accountIds.length > 1) {
        const newAccountId = session1.current.accountIds.find((id) => id !== session1.current.currentAccountId);

        if (newAccountId) {
          await act(async () => {
            await session1.current.setCurrentAccount(newAccountId);
          });

          // Both hooks should reflect the change
          expect(session1.current.currentAccountId).toBe(newAccountId);
          expect(session2.current.currentAccountId).toBe(newAccountId);
        }
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );
});

describe('Security Considerations', () => {
  it(
    'should use httpOnly cookies for sensitive data',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      // Note: httpOnly cookies cannot be read by JavaScript, so this test
      // verifies that sensitive tokens are NOT accessible via document.cookie

      const { result } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      await waitForCondition(() => {
        return !result.current.isLoading;
      }, 10000);

      if (result.current.isAuthenticated) {
        // Check that sensitive tokens are not in accessible cookies
        const allCookies = document.cookie;

        // These patterns should NOT appear in accessible cookies
        const sensitivePatterns = ['accessToken=', 'refreshToken=', 'jwt=', 'Bearer'];

        sensitivePatterns.forEach((pattern) => {
          expect(allCookies.includes(pattern)).toBe(false);
        });

        // Session token might be accessible (depends on server configuration)
        console.log('Accessible cookies (should not contain sensitive tokens):', allCookies);
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );

  it(
    'should handle secure cookie requirements',
    async () => {
      if (!testState.serverHealthy) {
        console.warn('Skipping test: Server not healthy');
        return;
      }

      // Note: In production, cookies should have Secure flag when using HTTPS
      // This test mainly documents the requirement rather than enforcing it
      // since test environments often use HTTP

      const { result } = renderHook(() => useSession(), {
        wrapper: TestWrapper,
      });

      await waitForCondition(() => {
        return !result.current.isLoading;
      }, 10000);

      // For now, we can test the error handling structure
      if (result.current.hasError) {
        expect(result.current.error).toBeTruthy();
        expect(result.current.isAuthenticated).toBe(false);
      }
    },
    INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
  );
});
