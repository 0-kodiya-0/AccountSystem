import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthPermissions } from '../useOAuthPermissions';
import { AccountType, CallbackCode } from '../../types';
import { createMockAuthService, createMockStoreSelectors, setupBrowserMocks, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock useAppStore
const { mockGetAccountState, mockUpdateAccountData } = createMockStoreSelectors();

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    return selector({
      getAccountState: mockGetAccountState,
      updateAccountData: mockUpdateAccountData,
    });
  }),
}));

describe('useOAuthPermissions', () => {
  const testAccountId = TEST_CONSTANTS.ACCOUNT_IDS.CURRENT;
  const testProvider = TEST_CONSTANTS.OAUTH.PROVIDER;
  const testCallbackUrl = TEST_CONSTANTS.OAUTH.CALLBACK_URL;
  const testScopes = TEST_CONSTANTS.OAUTH.SCOPES;
  let mockLocation: ReturnType<typeof setupBrowserMocks>['mockLocation'];
  let mockHistory: ReturnType<typeof setupBrowserMocks>['mockHistory'];

  beforeEach(() => {
    const browserMocks = setupBrowserMocks();
    mockLocation = browserMocks.mockLocation;
    mockHistory = browserMocks.mockHistory;

    // Default to OAuth account
    mockGetAccountState.mockReturnValue({
      data: {
        id: testAccountId,
        accountType: AccountType.OAuth,
      },
    });
  });

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.accountId).toBe(testAccountId);
      expect(result.current.canRequest).toBe(true);
    });

    test('should handle account type restrictions', () => {
      // Test with Local account (should not allow requests)
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.Local,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));
      expect(result.current.canRequest).toBe(false);

      // Test with null account
      const { result: result2 } = renderHook(() => useOAuthPermissions(null, { autoProcessCallback: false }));
      expect(result2.current.canRequest).toBe(false);
    });
  });

  describe('Permission Request Flow', () => {
    test('should handle successful permission request', async () => {
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?scope=profile',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('requesting');
      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toEqual(testScopes);

      expect(mockAuthService.generatePermissionUrl).toHaveBeenCalledWith(testProvider, {
        accountId: testAccountId,
        scopeNames: testScopes,
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle permission request errors', async () => {
      const error = new Error('Permission service unavailable');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to request permission: Permission service unavailable');
    });

    test('should validate request parameters', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, '');
      });

      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        'Failed to request permission: Callback URL is required for permission request',
      );
    });
  });

  describe('Reauthorization Flow', () => {
    test('should handle successful reauthorization', async () => {
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/reauthorize',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('reauthorizing');
      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toBeNull(); // Reauth doesn't specify scopes
      expect(mockAuthService.generateReauthorizeUrl).toHaveBeenCalledWith(testProvider, {
        accountId: testAccountId,
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle no reauthorization needed', async () => {
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: null, // No reauthorization needed
        state: undefined,
        scopes: undefined,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        message: 'No reauthorization needed',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.callbackMessage).toBe('No reauthorization needed');
    });
  });

  describe('URL Generation Methods', () => {
    test('should get permission URL without changing phase', async () => {
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?scope=profile',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const url = await result.current.getPermissionUrl(testProvider, testScopes, testCallbackUrl);
        expect(url).toBe('https://accounts.google.com/oauth/authorize?scope=profile');
        expect(result.current.phase).toBe('idle'); // Should not change phase
      });
    });

    test('should handle URL generation errors', async () => {
      const error = new Error('Failed to generate permission URL');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const url = await result.current.getPermissionUrl(testProvider, testScopes, testCallbackUrl);
        expect(url).toBe(null);
      });

      expect(result.current.error).toBe('Failed to get permission URL: Failed to generate permission URL');
    });
  });

  describe('Callback Processing', () => {
    test('should process successful permission callback', async () => {
      // Mock URL with successful permission callback
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=${testScopes.join(',')}&message=Permissions%20granted`;
      mockLocation.href = `http://localhost:3000?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=${testScopes.join(',')}&message=Permissions%20granted`;

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.grantedScopes).toEqual(testScopes);
      expect(result.current.callbackMessage).toBe('Permissions granted');
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    test('should handle permission callback errors', async () => {
      // Mock URL with error callback
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_ERROR}&error=Permission%20denied`;
      mockLocation.href = `http://localhost:3000?code=${CallbackCode.OAUTH_PERMISSION_ERROR}&error=Permission%20denied`;

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Permission denied');
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    test('should handle missing callback gracefully', async () => {
      // Mock URL without callback parameters
      mockLocation.search = '';
      mockLocation.href = 'http://localhost:3000';

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });

      expect(result.current.phase).toBe('idle'); // Should remain idle
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism for permission request', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');

      // Immediately try to retry - should be blocked by cooldown
      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toContain('Please wait');
      });

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?scope=profile',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for permissions...');
      });

      expect(result.current.retryCount).toBe(0); // Reset to 0 on successful retry
      expect(result.current.phase).toBe('requesting');
    });

    test('should handle retry for reauthorization', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateReauthorizeUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/reauthorize',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for reauthorization...');
      });

      expect(result.current.phase).toBe('reauthorizing');
    });

    test('should handle retry for callback processing', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // Set up callback with error
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_ERROR}&error=Permission%20denied`;

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful callback retry
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=${testScopes.join(',')}&message=Permissions%20granted`;

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback retry successful');
      });

      expect(result.current.phase).toBe('completed');
    });

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      const error = new Error('Persistent error');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      // Initial attempt fails
      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');

      // Perform exactly MAX_RETRY_ATTEMPTS (3) retries that all fail
      for (let i = 1; i <= 3; i++) {
        act(() => {
          vi.advanceTimersByTime(6000);
        });

        await act(async () => {
          const response = await result.current.retry();
          expect(response.success).toBe(false);
          expect(response.message).toBe('Failed to request permission: Persistent error');
        });
      }

      // After 3 failed retries, the next retry should hit the max limit
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('Maximum retry attempts (3) exceeded');
      });
    });

    test('should handle retry without previous operation', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous operation to retry');
      });
    });
  });

  describe('Auto-processing Callback', () => {
    test('should auto-process callback on mount when enabled', async () => {
      // Set up successful callback
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=${testScopes.join(',')}&message=Auto%20processed`;

      let result: any;
      await act(async () => {
        const hook = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: true }));
        result = hook.result;
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.grantedScopes).toEqual(testScopes);
      expect(result.current.callbackMessage).toBe('Auto processed');
    });

    test('should not auto-process when disabled', () => {
      // Set up callback
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=${testScopes.join(',')}&message=Should%20not%20process`;

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle'); // Should remain idle
      expect(result.current.grantedScopes).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle operations without account ID', async () => {
      const { result } = renderHook(() => useOAuthPermissions(null, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      // Should not call the service or change phase
      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });

    test('should validate reauthorization parameters', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, ''); // Empty callback URL
      });

      expect(mockAuthService.generateReauthorizeUrl).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        'Failed to reauthorize permissions: Callback URL is required for reauthorization',
      );
    });

    test('should handle URL generation parameter validation', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        // Test missing callback URL for permission URL
        const url1 = await result.current.getPermissionUrl(testProvider, testScopes, '');
        expect(url1).toBe(null);

        // Test missing callback URL for reauthorize URL
        const url2 = await result.current.getReauthorizeUrl(testProvider, '');
        expect(url2).toBe(null);
      });

      expect(result.current.error).toBe(
        'Failed to get reauthorize URL: Callback URL is required for reauthorization URL generation',
      );
    });

    test('should handle complex callback data parsing', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // Test callback with multiple scopes and boolean values
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=profile,email,calendar&message=Complex%20callback&granted=true`;

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
      });

      expect(result.current.grantedScopes).toEqual(['profile', 'email', 'calendar']);
      expect(result.current.callbackMessage).toBe('Complex callback');
    });

    test('should properly reset state and clear retry data', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.lastProvider).toBeNull();
      expect(result.current.lastScopes).toBeNull();
      expect(result.current.grantedScopes).toBeNull();
      expect(result.current.callbackMessage).toBeNull();
    });
  });

  describe('Progress and Status Management', () => {
    test('should track operation history correctly', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // Start permission request
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://example.com/auth',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toEqual(testScopes);
      expect(result.current.phase).toBe('requesting');

      // Now try reauthorization
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: 'https://example.com/reauth',
        state: 'state-456',
        scopes: undefined,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toBeNull(); // Reauth clears scopes
      expect(result.current.phase).toBe('reauthorizing');
    });

    test('should handle different scope formats in callbacks', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      // Test single scope as string
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&scopes=profile&message=Single%20scope`;

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
      });

      expect(result.current.grantedScopes).toEqual(['profile']);

      // Reset for next test
      act(() => {
        result.current.reset();
      });

      // Test no scopes
      mockLocation.search = `?code=${CallbackCode.OAUTH_PERMISSION_SUCCESS}&message=No%20scopes`;

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
      });

      expect(result.current.grantedScopes).toEqual([]);
    });
  });
});
