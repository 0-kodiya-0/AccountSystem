import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthPermissions } from '../useOAuthPermissions';
import { AccountType } from '../../types';
import { createMockAuthService, createMockStoreSelectors, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock useAppStore
const { mockGetAccountState } = createMockStoreSelectors();

describe('useOAuthPermissions', () => {
  const testAccountId = TEST_CONSTANTS.ACCOUNT_IDS.CURRENT;
  const testProvider = TEST_CONSTANTS.OAUTH.PROVIDER;
  const testCallbackUrl = TEST_CONSTANTS.OAUTH.CALLBACK_URL;
  const testScopes = TEST_CONSTANTS.OAUTH.SCOPES;

  beforeEach(() => {
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
      expect(result.current.error).toBe('Callback URL is required for permission request');
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
        expect(url).toBe('');
      });

      expect(result.current.error).toBe('Failed to get permission URL: Failed to generate permission URL');
    });
  });

  describe('Account Restrictions', () => {
    test('should handle operations on non-OAuth accounts gracefully', async () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.Local,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.canRequest).toBe(false);
    });

    test('should handle missing account data', () => {
      mockGetAccountState.mockReturnValue(null);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      expect(result.current.canRequest).toBe(false);
    });
  });

  describe('Callback Processing', () => {
    test('should handle callback processing', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });
    });
  });
});
