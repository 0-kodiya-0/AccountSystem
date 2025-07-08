import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useSession } from '../../../src/hooks/useSession';
import { useAccount } from '../../../src/hooks/useAccount';
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

describe('Session Management Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('Session Loading', () => {
    it(
      'should load session data correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Initial state
        expect(result.current.data).toBe(null);
        expect(result.current.isIdle).toBe(true);

        // Load session
        await act(async () => {
          await result.current.load();
        });

        // Check session state
        if (result.current.isAuthenticated) {
          expect(result.current.data).toBeTruthy();
          expect(result.current.data?.hasSession).toBe(true);
          expect(result.current.data?.isValid).toBe(true);
          expect(result.current.accountIds).toBeTruthy();
          expect(Array.isArray(result.current.accountIds)).toBe(true);
          expect(result.current.isSuccess).toBe(true);
        } else {
          // No active session (expected in fresh test environment)
          expect(result.current.data?.hasSession).toBe(false);
          console.log('No active session found (expected in fresh test environment)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should auto-load session by default',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Should start loading automatically
        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        expect(result.current.isSuccess || result.current.hasError).toBe(true);
        expect(result.current.data).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should disable auto-load when configured',
      async () => {
        const { result } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapper,
        });

        // Should remain idle
        expect(result.current.isIdle).toBe(true);
        expect(result.current.data).toBe(null);

        // Manual load should work
        if (testState.serverHealthy) {
          await act(async () => {
            await result.current.load();
          });

          expect(result.current.data).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session Accounts Loading', () => {
    it(
      'should load session accounts when configured',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: true }), {
          wrapper: TestWrapper,
        });

        // Wait for session and session accounts to load
        await waitForCondition(() => {
          return !result.current.isLoading && !result.current.sessionAccountsLoading;
        }, 15000);

        if (result.current.isAuthenticated && result.current.accountIds.length > 0) {
          expect(result.current.sessionAccountsSuccess).toBe(true);
          expect(result.current.accounts).toBeTruthy();
          expect(Array.isArray(result.current.accounts)).toBe(true);
          expect(result.current.accounts.length).toBe(result.current.accountIds.length);

          // Check account structure
          result.current.accounts.forEach((account) => {
            expect(account.id).toBeTruthy();
            expect(account.accountType).toBeTruthy();
            expect(account.userDetails).toBeTruthy();
            expect(account.userDetails.name).toBeTruthy();
          });
        } else {
          console.log('No accounts to load session data for');
        }
      },
      INTEGRATION_CONFIG.LONG_TIMEOUT,
    );

    it(
      'should load session accounts manually',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: false }), {
          wrapper: TestWrapper,
        });

        // Wait for session to load first
        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated && result.current.accountIds.length > 0) {
          // Manually load session accounts
          await act(async () => {
            await result.current.loadSessionAccounts();
          });

          expect(result.current.sessionAccountsSuccess).toBe(true);
          expect(result.current.accounts.length).toBeGreaterThan(0);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Current Account Management', () => {
    it(
      'should set current account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated && result.current.accountIds.length > 1) {
          const originalAccountId = result.current.currentAccountId;
          const newAccountId = result.current.accountIds.find((id) => id !== originalAccountId);

          if (newAccountId) {
            await act(async () => {
              await result.current.setCurrentAccount(newAccountId);
            });

            expect(result.current.currentAccountId).toBe(newAccountId);
            expect(result.current.hasAccount).toBe(true);
          } else {
            console.warn('Only one account available, cannot test account switching');
          }
        } else {
          console.warn('Insufficient accounts for current account test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear current account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated && result.current.hasAccount) {
          await act(async () => {
            await result.current.setCurrentAccount(null);
          });

          expect(result.current.currentAccountId).toBe(null);
          expect(result.current.hasAccount).toBe(false);
          expect(result.current.isAuthenticated).toBe(true); // Still authenticated, just no current account
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session Logout', () => {
    it(
      'should logout all accounts',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated) {
          await act(async () => {
            await result.current.logoutAll();
          });

          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.data?.hasSession).toBe(false);
          expect(result.current.accountIds).toHaveLength(0);
          expect(result.current.currentAccountId).toBe(null);
        } else {
          console.warn('No active session to logout from');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle session load errors',
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

        const { result } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapperBadUrl,
        });

        await act(async () => {
          await result.current.load();
        });

        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toBeTruthy();
        expect(result.current.data).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle session accounts load errors',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }), {
          wrapper: TestWrapper,
        });

        // Load session first
        await act(async () => {
          await result.current.load();
        });

        if (result.current.isAuthenticated) {
          // Temporarily break the connection for session accounts
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

          const { result: badResult } = renderHook(() => useSession({ autoLoad: false }), {
            wrapper: TestWrapperBadUrl,
          });

          await act(async () => {
            await badResult.current.loadSessionAccounts();
          });

          expect(badResult.current.sessionAccountsError).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Cookie Management', () => {
    it(
      'should handle session cookies correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        // Check for session-related cookies
        const sessionCookie = getCookieValue('accountSession');

        if (result.current.isAuthenticated) {
          expect(sessionCookie).toBeTruthy();
        } else {
          // No session, so session cookie might not exist
          console.log('No active session, session cookie check skipped');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear session cookies on logout',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated) {
          // Check cookies before logout
          const sessionCookieBefore = getCookieValue('accountSession');
          expect(sessionCookieBefore).toBeTruthy();

          // Logout
          await act(async () => {
            await result.current.logoutAll();
          });

          // Check cookies after logout
          const sessionCookieAfter = getCookieValue('accountSession');
          // Cookie should be cleared or empty
          expect(sessionCookieAfter === null || sessionCookieAfter === '').toBe(true);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session State Management', () => {
    it(
      'should track session loading states correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoad: false }), {
          wrapper: TestWrapper,
        });

        // Initial state
        expect(result.current.isIdle).toBe(true);
        expect(result.current.isLoading).toBe(false);

        // Start loading
        act(() => {
          result.current.load();
        });

        expect(result.current.isLoading).toBe(true);

        // Wait for completion
        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        expect(result.current.isSuccess || result.current.hasError).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should track session accounts loading states correctly',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: false }), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.isAuthenticated && result.current.accountIds.length > 0) {
          // Initial session accounts state
          expect(result.current.sessionAccountsLoading).toBe(false);

          // Start loading session accounts
          act(() => {
            result.current.loadSessionAccounts();
          });

          expect(result.current.sessionAccountsLoading).toBe(true);

          // Wait for completion
          await waitForCondition(() => {
            return !result.current.sessionAccountsLoading;
          }, 10000);

          expect(result.current.sessionAccountsSuccess || result.current.sessionAccountsError).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session Integration with Account Management', () => {
    it(
      'should integrate with account hooks',
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

          expect(accountResult.current.id).toBe(sessionResult.current.currentAccountId);
          expect(accountResult.current.isCurrent).toBe(true);

          if (accountResult.current.exists) {
            expect(accountResult.current.data).toBeTruthy();
            expect(accountResult.current.data?.id).toBe(sessionResult.current.currentAccountId);
          }
        } else {
          console.warn('No current account for account integration test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle account switching integration',
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

        if (sessionResult.current.isAuthenticated && sessionResult.current.accountIds.length > 1) {
          const targetAccountId = sessionResult.current.accountIds.find(
            (id) => id !== sessionResult.current.currentAccountId,
          );

          if (targetAccountId) {
            const { result: accountResult } = renderHook(() => useAccount(targetAccountId), { wrapper: TestWrapper });

            // Switch to this account via account hook
            await act(async () => {
              await accountResult.current.switchToThisAccount();
            });

            // Session should reflect the change
            expect(sessionResult.current.currentAccountId).toBe(targetAccountId);
            expect(accountResult.current.isCurrent).toBe(true);
          }
        } else {
          console.warn('Insufficient accounts for switching test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session Persistence', () => {
    it(
      'should persist session across hook remounts',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // First hook instance
        const { result: firstResult, unmount: firstUnmount } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !firstResult.current.isLoading;
        }, 10000);

        const firstSessionData = firstResult.current.data;
        const firstAuthStatus = firstResult.current.isAuthenticated;

        // Unmount first instance
        firstUnmount();

        // Create second hook instance
        const { result: secondResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !secondResult.current.isLoading;
        }, 10000);

        // Should have same session state
        expect(secondResult.current.isAuthenticated).toBe(firstAuthStatus);

        if (firstAuthStatus) {
          expect(secondResult.current.data?.hasSession).toBe(firstSessionData?.hasSession);
          expect(secondResult.current.accountIds).toEqual(firstSessionData?.accountIds);
          expect(secondResult.current.currentAccountId).toBe(firstSessionData?.currentAccountId);
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Session Refresh and Validation', () => {
    it(
      'should handle session refresh',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        const initialLoadTime = result.current.data ? Date.now() : null;

        // Reload session
        await act(async () => {
          await result.current.load();
        });

        const secondLoadTime = Date.now();

        expect(secondLoadTime).toBeGreaterThan(initialLoadTime || 0);
        expect(result.current.isSuccess || result.current.hasError).toBe(true);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should validate session data structure',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const { result } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isLoading;
        }, 10000);

        if (result.current.data) {
          // Validate session data structure
          expect(typeof result.current.data.hasSession).toBe('boolean');
          expect(typeof result.current.data.isValid).toBe('boolean');
          expect(Array.isArray(result.current.data.accountIds)).toBe(true);
          expect(
            result.current.data.currentAccountId === null || typeof result.current.data.currentAccountId === 'string',
          ).toBe(true);

          // If has session, should have valid structure
          if (result.current.data.hasSession) {
            expect(result.current.data.isValid).toBe(true);
          }
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});
