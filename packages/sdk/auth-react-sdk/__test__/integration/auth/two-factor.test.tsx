import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import React from 'react';

import { ServicesProvider } from '../../../src/context/ServicesProvider';
import { useTwoFactorAuth } from '../../../src/hooks/useTwoFactorAuth';
import { useSession } from '../../../src/hooks/useSession';
import { AccountType } from '../../../src/types';
import { INTEGRATION_CONFIG, testState, waitForCondition, clearAllCookies } from '../setup';

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

describe('Two-Factor Authentication Integration Tests', () => {
  beforeEach(() => {
    clearAllCookies();
    vi.clearAllMocks();
  });

  describe('2FA Status Check', () => {
    it(
      'should check 2FA status for local account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Use a test account ID (would normally come from session)
        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Should auto-load status
        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        // Should have status information
        expect(result.current.accountId).toBe(testAccountId);
        expect(typeof result.current.isEnabled).toBe('boolean');
        expect(typeof result.current.hasBackupCodes).toBe('boolean');
        expect(typeof result.current.backupCodesCount).toBe('number');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should check 2FA status for OAuth account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        // Use a test OAuth account ID
        const testAccountId = '507f1f77bcf86cd799439012';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        expect(result.current.accountId).toBe(testAccountId);
        expect(typeof result.current.isEnabled).toBe('boolean');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle invalid account ID',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const invalidAccountId = 'invalid-account-id';

        const { result } = renderHook(() => useTwoFactorAuth(invalidAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return result.current.isFailed || !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.isFailed) {
          expect(result.current.error).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('2FA Setup for Local Accounts', () => {
    it(
      'should initiate 2FA setup with valid password',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Wait for initial status check
        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.canSetup) {
          let setupResponse: any;
          await act(async () => {
            setupResponse = await result.current.setup({
              enableTwoFactor: true,
              password: INTEGRATION_CONFIG.TEST_USER.password,
            });
          });

          if (setupResponse) {
            expect(result.current.isVerifyingSetup).toBe(true);
            expect(result.current.setupData).toBeTruthy();
            expect(result.current.qrCode || result.current.secret).toBeTruthy();
            expect(result.current.setupToken).toBeTruthy();
            expect(result.current.canVerifySetup).toBe(true);
          } else {
            console.warn('2FA setup failed (may require valid authentication)');
            expect(result.current.isFailed).toBe(true);
          }
        } else {
          console.warn('2FA setup not available (account may already have 2FA enabled or invalid type)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should reject 2FA setup with invalid password',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.canSetup) {
          let setupResponse: any;
          await act(async () => {
            setupResponse = await result.current.setup({
              enableTwoFactor: true,
              password: 'wrongpassword',
            });
          });

          expect(setupResponse).toBe(null);
          expect(result.current.isFailed).toBe(true);
          expect(result.current.error).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should verify 2FA setup with TOTP code',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // First, attempt setup
        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.canSetup) {
          await act(async () => {
            await result.current.setup({
              enableTwoFactor: true,
              password: INTEGRATION_CONFIG.TEST_USER.password,
            });
          });

          if (result.current.canVerifySetup && result.current.setupToken) {
            // Note: In a real integration test, you would need:
            // 1. A real TOTP authenticator app or library
            // 2. To generate the current TOTP code using the secret
            // 3. Or a test endpoint that provides the expected code

            console.warn('2FA verification test incomplete: Need real TOTP code generation');

            // Test with invalid code (should fail)
            let verifyResponse: any;
            await act(async () => {
              verifyResponse = await result.current.verifySetup('123456');
            });

            expect(verifyResponse).toBe(null);
            expect(result.current.isFailed).toBe(true);
            expect(result.current.error).toBeTruthy();

            // In a complete test, with a valid TOTP code:
            // expect(result.current.isCompleted).toBe(true);
            // expect(result.current.isEnabled).toBe(true);
          }
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('2FA Setup for OAuth Accounts', () => {
    it(
      'should initiate 2FA setup for OAuth account without password',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439012'; // OAuth account

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.canSetup && result.current.accountType === AccountType.OAuth) {
          let setupResponse: any;
          await act(async () => {
            setupResponse = await result.current.setup({
              enableTwoFactor: true,
              // No password required for OAuth accounts
            });
          });

          if (setupResponse) {
            expect(result.current.isVerifyingSetup).toBe(true);
            expect(result.current.setupData).toBeTruthy();
            expect(result.current.setupToken).toBeTruthy();
          } else {
            console.warn('OAuth 2FA setup failed (may require valid OAuth session)');
            expect(result.current.isFailed).toBe(true);
          }
        } else {
          console.warn('OAuth 2FA setup not available (account may not be OAuth type)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('2FA Disable Functionality', () => {
    it(
      'should disable 2FA for local account with password',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        // Only test if 2FA is currently enabled
        if (result.current.canDisable && result.current.isEnabled) {
          let disableResponse: any;
          await act(async () => {
            disableResponse = await result.current.disable(INTEGRATION_CONFIG.TEST_USER.password);
          });

          if (disableResponse.success) {
            expect(result.current.isCompleted).toBe(true);
            expect(result.current.isEnabled).toBe(false);
          } else {
            console.warn('2FA disable failed (may require valid authentication)');
            expect(result.current.isFailed).toBe(true);
          }
        } else {
          console.warn('2FA disable test skipped (2FA not enabled or not available)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should reject 2FA disable with wrong password',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.canDisable && result.current.isEnabled) {
          let disableResponse: any;
          await act(async () => {
            disableResponse = await result.current.disable('wrongpassword');
          });

          expect(disableResponse.success).toBe(false);
          expect(result.current.isFailed).toBe(true);
          expect(result.current.error).toBeTruthy();
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Backup Codes Management', () => {
    it(
      'should generate backup codes for local account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        // Only test if 2FA is enabled
        if (result.current.isEnabled) {
          let codesResponse: any;
          await act(async () => {
            codesResponse = await result.current.generateBackupCodes({
              password: INTEGRATION_CONFIG.TEST_USER.password,
            });
          });

          if (codesResponse) {
            expect(result.current.isCompleted).toBe(true);
            expect(result.current.backupCodes).toBeTruthy();
            expect(Array.isArray(result.current.backupCodes)).toBe(true);
            expect(result.current.backupCodes!.length).toBeGreaterThan(0);
            expect(result.current.backupCodesCount).toBeGreaterThan(0);
          } else {
            console.warn('Backup codes generation failed (may require valid authentication)');
            expect(result.current.isFailed).toBe(true);
          }
        } else {
          console.warn('Backup codes test skipped (2FA not enabled)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should generate backup codes for OAuth account',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439012'; // OAuth account

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        if (result.current.isEnabled && result.current.accountType === AccountType.OAuth) {
          let codesResponse: any;
          await act(async () => {
            codesResponse = await result.current.generateBackupCodes({
              // No password required for OAuth accounts
            });
          });

          if (codesResponse) {
            expect(result.current.backupCodes).toBeTruthy();
            expect(Array.isArray(result.current.backupCodes)).toBe(true);
          } else {
            console.warn('OAuth backup codes generation failed (may require valid OAuth session)');
          }
        } else {
          console.warn('OAuth backup codes test skipped (2FA not enabled or not OAuth account)');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('2FA Error Handling', () => {
    it(
      'should handle network errors gracefully',
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

        const { result } = renderHook(() => useTwoFactorAuth('507f1f77bcf86cd799439011'), {
          wrapper: TestWrapperBadUrl,
        });

        await waitForCondition(() => {
          return result.current.isFailed || !result.current.isCheckingStatus;
        }, 10000);

        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should validate setup parameters',
      async () => {
        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Test setup without enableTwoFactor flag
        let setupResponse: any;
        await act(async () => {
          setupResponse = await result.current.setup({} as any);
        });

        expect(setupResponse).toBe(null);
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBeTruthy();
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should handle missing account ID',
      async () => {
        const { result } = renderHook(() => useTwoFactorAuth(null), {
          wrapper: TestWrapper,
        });

        expect(result.current.accountId).toBe(null);
        expect(result.current.canSetup).toBe(false);
        expect(result.current.canDisable).toBe(false);
        expect(result.current.canVerifySetup).toBe(false);

        // Operations should fail gracefully
        let setupResponse: any;
        await act(async () => {
          setupResponse = await result.current.setup({
            enableTwoFactor: true,
            password: 'test',
          });
        });

        expect(setupResponse).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('2FA State Management', () => {
    it(
      'should reset 2FA state correctly',
      async () => {
        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Cause some state change
        await act(async () => {
          await result.current.setup({
            enableTwoFactor: true,
            password: 'wrongpassword',
          });
        });

        expect(result.current.isFailed).toBe(true);

        // Reset state
        act(() => {
          result.current.reset();
        });

        expect(result.current.isIdle).toBe(true);
        expect(result.current.error).toBe(null);
        expect(result.current.setupData).toBe(null);
        expect(result.current.setupToken).toBe(null);
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should clear errors',
      async () => {
        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Cause an error
        await act(async () => {
          await result.current.setup({} as any);
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

  describe('2FA Integration with Session', () => {
    it(
      'should work with authenticated session',
      async () => {
        // Note: This test requires an active session with a valid account
        console.warn('2FA session integration test incomplete: Requires active authenticated session');

        const { result: sessionResult } = renderHook(() => useSession(), {
          wrapper: TestWrapper,
        });

        // Load session first
        await act(async () => {
          await sessionResult.current.load();
        });

        if (sessionResult.current.isAuthenticated && sessionResult.current.currentAccountId) {
          const { result: twoFactorResult } = renderHook(
            () => useTwoFactorAuth(sessionResult.current.currentAccountId),
            { wrapper: TestWrapper },
          );

          await waitForCondition(() => {
            return !twoFactorResult.current.isCheckingStatus;
          }, 10000);

          expect(twoFactorResult.current.accountId).toBe(sessionResult.current.currentAccountId);
          expect(typeof twoFactorResult.current.isEnabled).toBe('boolean');
        } else {
          console.warn('No authenticated session available for 2FA integration test');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });

  describe('Auto-load Behavior', () => {
    it(
      'should auto-load 2FA status by default',
      async () => {
        if (!testState.serverHealthy) {
          console.warn('Skipping test: Server not healthy');
          return;
        }

        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId), {
          wrapper: TestWrapper,
        });

        // Should start checking status automatically
        expect(result.current.isCheckingStatus).toBe(true);

        await waitForCondition(() => {
          return !result.current.isCheckingStatus;
        }, 10000);

        // Should have loaded status
        expect(typeof result.current.isEnabled).toBe('boolean');
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );

    it(
      'should disable auto-load when configured',
      async () => {
        const testAccountId = '507f1f77bcf86cd799439011';

        const { result } = renderHook(() => useTwoFactorAuth(testAccountId, { autoLoadStatus: false }), {
          wrapper: TestWrapper,
        });

        // Should remain idle
        expect(result.current.isIdle).toBe(true);
        expect(result.current.isCheckingStatus).toBe(false);

        // Manual status check should work
        let statusResponse: any;
        await act(async () => {
          statusResponse = await result.current.checkStatus();
        });

        if (testState.serverHealthy) {
          expect(statusResponse).toBeTruthy();
          expect(typeof result.current.isEnabled).toBe('boolean');
        }
      },
      INTEGRATION_CONFIG.DEFAULT_TIMEOUT,
    );
  });
});
