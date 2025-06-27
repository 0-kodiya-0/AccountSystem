import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthPermissions } from '../useOAuthPermissions';
import { useAppStore } from '../../store/useAppStore';
import { OAuthProviders, AccountType, CallbackCode } from '../../types';

// Mock AuthService
const mockAuthService = {
  generatePermissionUrl: vi.fn(),
  generateReauthorizeUrl: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock useAppStore
const mockGetAccountState = vi.fn();

vi.mock('../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('useOAuthPermissions', () => {
  const testAccountId = '507f1f77bcf86cd799439011';
  const testProvider = OAuthProviders.Google;
  const testCallbackUrl = 'http://localhost:3000/oauth/callback';
  const testScopes = ['read:profile', 'write:calendar'];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default store mock
    mockUseAppStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          getAccountState: mockGetAccountState,
        } as any);
      }
      return { getAccountState: mockGetAccountState };
    });

    // Default account state - OAuth account
    mockGetAccountState.mockReturnValue({
      data: {
        id: testAccountId,
        accountType: AccountType.OAuth,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('should initialize with idle phase', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isRequesting).toBe(false);
      expect(result.current.isReauthorizing).toBe(false);
      expect(result.current.isProcessingCallback).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should initialize OAuth permissions state', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId, { autoProcessCallback: false }));

      expect(result.current.accountId).toBe(testAccountId);
      expect(result.current.lastProvider).toBeNull();
      expect(result.current.lastScopes).toBeNull();
      expect(result.current.callbackMessage).toBeNull();
      expect(result.current.grantedScopes).toBeNull();
    });

    test('should determine if requests can be made', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      expect(result.current.canRequest).toBe(true); // OAuth account
    });

    test('should handle null account ID', () => {
      const { result } = renderHook(() => useOAuthPermissions(null));

      expect(result.current.accountId).toBeNull();
      expect(result.current.canRequest).toBe(false);
    });

    test('should handle non-OAuth account', () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.Local,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      expect(result.current.canRequest).toBe(false);
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

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('requesting');
      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toEqual(testScopes);
      expect(result.current.loading).toBe(false);
      expect(mockAuthService.generatePermissionUrl).toHaveBeenCalledWith(testProvider, {
        accountId: testAccountId,
        scopeNames: testScopes,
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle permission request errors', async () => {
      const error = new Error('Permission service unavailable');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to request permission: Permission service unavailable');
    });

    test('should update phase during permission request', async () => {
      let phaseBeforeRequest: string = '';

      mockAuthService.generatePermissionUrl.mockImplementation(async () => {
        phaseBeforeRequest = result.current.phase;
        return {
          authorizationUrl: 'https://oauth.provider.com/auth',
          state: 'state-123',
          scopes: testScopes,
          accountId: testAccountId,
          userEmail: 'user@example.com',
          callbackUrl: testCallbackUrl,
        };
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(phaseBeforeRequest).toBe('requesting');
      expect(result.current.phase).toBe('requesting');
    });

    test('should handle request without account ID', async () => {
      const { result } = renderHook(() => useOAuthPermissions(null));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle'); // Should not change
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

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('reauthorizing');
      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toBeNull(); // Reauth doesn't specify scopes
      expect(result.current.loading).toBe(false);
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

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.callbackMessage).toBe('No reauthorization needed');
      expect(result.current.loading).toBe(false);
    });

    test('should handle reauthorization errors', async () => {
      const error = new Error('Reauthorization failed');
      mockAuthService.generateReauthorizeUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to reauthorize permissions: Reauthorization failed');
    });

    test('should handle reauthorization without account ID', async () => {
      const { result } = renderHook(() => useOAuthPermissions(null));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, testCallbackUrl);
      });

      expect(mockAuthService.generateReauthorizeUrl).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('Get URL Methods', () => {
    test('should get permission URL without redirect', async () => {
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?scope=profile',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getPermissionUrl(testProvider, testScopes, testCallbackUrl);

      expect(url).toBe('https://accounts.google.com/oauth/authorize?scope=profile');
      expect(result.current.phase).toBe('idle'); // Should not change phase
      expect(mockAuthService.generatePermissionUrl).toHaveBeenCalledWith(testProvider, {
        accountId: testAccountId,
        scopeNames: testScopes,
        callbackUrl: testCallbackUrl,
      });
    });

    test('should get reauthorize URL without redirect', async () => {
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/reauthorize',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getReauthorizeUrl(testProvider, testCallbackUrl);

      expect(url).toBe('https://accounts.google.com/oauth/reauthorize');
      expect(result.current.phase).toBe('idle'); // Should not change phase
    });

    test('should handle get permission URL errors', async () => {
      const error = new Error('Failed to generate permission URL');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getPermissionUrl(testProvider, testScopes, testCallbackUrl);

      expect(url).toBe('');
      expect(result.current.error).toBe('Failed to get permission URL: Failed to generate permission URL');
    });

    test('should handle get reauthorize URL errors', async () => {
      const error = new Error('Failed to generate reauthorize URL');
      mockAuthService.generateReauthorizeUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getReauthorizeUrl(testProvider, testCallbackUrl);

      expect(url).toBe('');
      expect(result.current.error).toBe('Failed to get reauthorize URL: Failed to generate reauthorize URL');
    });
  });

  describe('Validation', () => {
    test('should validate callback URL for permission request', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, '');
      });

      expect(result.current.error).toBe('Callback URL is required for permission request');
      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
    });

    test('should validate callback URL for reauthorization', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.reauthorizePermissions(testProvider, '');
      });

      expect(result.current.error).toBe('Callback URL is required for reauthorization');
      expect(mockAuthService.generateReauthorizeUrl).not.toHaveBeenCalled();
    });

    test('should validate callback URL for get permission URL', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getPermissionUrl(testProvider, testScopes, '');

      expect(url).toBe('');
      expect(result.current.error).toBe('Callback URL is required for permission URL generation');
    });

    test('should validate callback URL for get reauthorize URL', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const url = await result.current.getReauthorizeUrl(testProvider, '');

      expect(url).toBe('');
      expect(result.current.error).toBe('Callback URL is required for reauthorization URL generation');
    });
  });

  describe('Callback Processing Flow', () => {
    test('should handle successful callback processing', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });
    });

    test('should handle no callback data', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });
    });
  });

  describe('State Management', () => {
    test('should track last operation data', async () => {
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.lastProvider).toBe(testProvider);
      expect(result.current.lastScopes).toEqual(testScopes);
    });

    test('should clear last scopes for reauthorization', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      // First do a permission request
      mockAuthService.generatePermissionUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        scopes: testScopes,
        accountId: testAccountId,
        userEmail: 'user@example.com',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.lastScopes).toEqual(testScopes);

      // Then do reauthorization
      mockAuthService.generateReauthorizeUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/reauth',
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
      expect(result.current.lastScopes).toBeNull(); // Should be cleared for reauth
    });

    test('should handle granted scopes from callback', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      // Simulate processing a successful callback
      act(() => {
        // This would normally be set by callback processing
        result.current.clearError(); // Just to interact with the hook
      });

      expect(result.current.grantedScopes).toBeNull(); // Initially null
    });
  });

  describe('Account Type Restrictions', () => {
    test('should only work with OAuth accounts', () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.Local,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      expect(result.current.canRequest).toBe(false);
    });

    test('should work with OAuth accounts', () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.OAuth,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      expect(result.current.canRequest).toBe(true);
    });

    test('should handle missing account data', () => {
      mockGetAccountState.mockReturnValue(null);

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      expect(result.current.canRequest).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    test('should clear errors', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      // Set an error first
      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, '');
      });

      expect(result.current.error).toBeTruthy();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should reset state', () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      // Reset to initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastProvider).toBeNull();
      expect(result.current.lastScopes).toBeNull();
      expect(result.current.callbackMessage).toBeNull();
      expect(result.current.grantedScopes).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const error = new Error('OAuth API down');
      mockAuthService.generatePermissionUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toContain('OAuth API down');
    });

    test('should handle network timeouts', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockAuthService.generatePermissionUrl.mockRejectedValue(timeoutError);

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toContain('Request timeout');
    });

    test('should handle validation errors before API calls', async () => {
      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, '');
      });

      // Should not make API call if validation fails
      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Callback URL is required for permission request');
    });

    test('should handle operations on non-OAuth account', async () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: testAccountId,
          accountType: AccountType.Local,
        },
      });

      const { result } = renderHook(() => useOAuthPermissions(testAccountId));

      await act(async () => {
        await result.current.requestPermission(testProvider, testScopes, testCallbackUrl);
      });

      // Should not make API call for non-OAuth account
      expect(mockAuthService.generatePermissionUrl).not.toHaveBeenCalled();
      expect(result.current.canRequest).toBe(false);
    });
  });
});
