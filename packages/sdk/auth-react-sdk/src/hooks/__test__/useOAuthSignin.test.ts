import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthSignin } from '../useOAuthSignin';
import { OAuthProviders } from '../../types';

// Mock AuthService
const mockAuthService = {
  generateOAuthSigninUrl: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useOAuthSignin', () => {
  const testProvider = OAuthProviders.Google;
  const testCallbackUrl = 'http://localhost:3000/oauth/callback';

  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers - this handles Date mocking automatically!
    vi.useFakeTimers();
    // Set a specific time for consistent testing
    vi.setSystemTime(new Date('2022-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore real timers
    vi.useRealTimers();
  });

  describe('Hook Initialization', () => {
    test('should initialize with idle phase', () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isRedirecting).toBe(false);
      expect(result.current.isProcessingCallback).toBe(false);
      expect(result.current.isRequires2FA).toBe(false);
      expect(result.current.isVerifying2FA).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should initialize OAuth-specific state', () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.requiresTwoFactor).toBe(false);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.needsAdditionalScopes).toBe(false);
      expect(result.current.missingScopes).toEqual([]);
      expect(result.current.callbackMessage).toBeNull();
      expect(result.current.canRetry).toBe(false);
    });

    test('should initialize progress tracking', () => {
      const { result } = renderHook(() => useOAuthSignin());

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to start OAuth signin');
      expect(result.current.nextStep).toBe('Choose OAuth provider');
    });
  });

  describe('OAuth Signin Flow', () => {
    test('should handle successful signin initiation', async () => {
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for signin...');
      });

      expect(result.current.phase).toBe('processing_callback');
      expect(result.current.provider).toBe(testProvider);
      expect(result.current.loading).toBe(false);
      expect(mockAuthService.generateOAuthSigninUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle signin initiation errors', async () => {
      const error = new Error('OAuth service unavailable');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to start google signin: OAuth service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to start google signin: OAuth service unavailable');
    });

    test('should update phase during signin initiation', async () => {
      let phaseBeforeRequest: string = '';

      mockAuthService.generateOAuthSigninUrl.mockImplementation(async () => {
        phaseBeforeRequest = result.current.phase;
        return {
          authorizationUrl: 'https://oauth.provider.com/auth',
          state: 'state-123',
          provider: 'google',
          authType: 'signin',
          callbackUrl: testCallbackUrl,
        };
      });

      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        await result.current.startSignin(testProvider, testCallbackUrl);
      });

      expect(phaseBeforeRequest).toBe('redirecting');
      expect(result.current.phase).toBe('processing_callback');
    });

    test('should handle failed URL generation', async () => {
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: '', // Empty URL
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to generate OAuth signin URL');
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('Validation', () => {
    test('should validate empty provider', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin('' as any, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('OAuth provider is required');
      });

      expect(result.current.error).toBe('OAuth provider is required');
    });

    test('should validate empty callback URL', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(testProvider, '');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Callback URL is required');
      });
    });

    test('should validate whitespace callback URL', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(testProvider, '   ');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Callback URL is required');
      });
    });

    test('should validate null provider', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.startSignin(null as any, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('OAuth provider is required');
      });
    });
  });

  describe('2FA Verification Flow', () => {
    test('should handle successful 2FA verification', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // First set up 2FA state manually
      await act(async () => {
        // Simulate being in requires_2fa state with temp token
        result.current.reset();
      });

      // Mock successful 2FA verification
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: '2FA verification successful',
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA verification successful');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.isCompleted).toBe(true);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.callbackMessage).toBe('2FA verification successful');
    });

    test('should handle 2FA verification with additional scopes', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Mock 2FA verification that needs additional scopes
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: '2FA successful, additional permissions needed',
        needsAdditionalScopes: true,
        missingScopes: ['read:profile', 'write:calendar'],
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(true);
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.needsAdditionalScopes).toBe(true);
      expect(result.current.missingScopes).toEqual(['read:profile', 'write:calendar']);
    });

    test('should handle 2FA verification errors', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      const error = new Error('Invalid 2FA code');
      mockAuthService.verifyTwoFactorLogin.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verify2FA('wrongcode');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Two-factor verification failed: Invalid 2FA code');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Two-factor verification failed: Invalid 2FA code');
    });

    test('should validate empty 2FA token', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.verify2FA('');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Verification code is required');
      });
    });

    test('should validate missing temp token', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(false);
        expect(response.message).toBe('No temporary token available. Please sign in again.');
      });
    });
  });

  describe('Get Signin URL Flow', () => {
    test('should get signin URL without redirect', async () => {
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignin());

      const url = await result.current.getSigninUrl(testProvider, testCallbackUrl);

      expect(url).toBe('https://accounts.google.com/oauth/authorize?client_id=...');
      expect(result.current.phase).toBe('idle'); // Should not change phase
      expect(mockAuthService.generateOAuthSigninUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle get signin URL errors', async () => {
      const error = new Error('Failed to generate URL');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignin());

      const url = await result.current.getSigninUrl(testProvider, testCallbackUrl);

      expect(url).toBe('');
      expect(result.current.error).toBe('Failed to get google signin URL: Failed to generate URL');
    });

    test('should validate get signin URL parameters', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Test empty provider
      const url1 = await result.current.getSigninUrl('' as any, testCallbackUrl);
      expect(url1).toBe('');

      // Test empty callback URL
      const url2 = await result.current.getSigninUrl(testProvider, '');
      expect(url2).toBe('');
    });
  });

  describe('Retry Logic', () => {
    test('should retry with cooldown', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignin(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown (5 seconds)
      vi.advanceTimersByTime(6000);

      expect(result.current.canRetry).toBe(true);

      // Mock successful retry
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(result.current.retryCount).toBe(1);
      });
    });

    test('should respect retry limits', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Simulate being at max retries
      const error = new Error('Persistent error');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.startSignin(testProvider, testCallbackUrl);
        });

        if (i < 2) {
          vi.advanceTimersByTime(6000); // Advance past cooldown
          await act(async () => {
            await result.current.retry();
          });
        }
      }

      // Should not allow more retries
      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('Maximum retry attempts (3) exceeded');
      });
    });

    test('should handle retry without previous attempt', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signin attempt to retry');
      });
    });
  });

  describe('Progress and Phase Management', () => {
    test('should calculate progress correctly', () => {
      const { result } = renderHook(() => useOAuthSignin());

      expect(result.current.progress).toBe(0); // idle
      expect(result.current.currentStep).toBe('Ready to start OAuth signin');
      expect(result.current.nextStep).toBe('Choose OAuth provider');
    });

    test('should provide correct step descriptions', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Initial state
      expect(result.current.currentStep).toBe('Ready to start OAuth signin');
      expect(result.current.nextStep).toBe('Choose OAuth provider');

      // After starting signin
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.startSignin(testProvider, testCallbackUrl);
      });

      // Progress should update based on phase
      expect(result.current.progress).toBeGreaterThan(0);
    });

    test('should transition through phases correctly', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Initial state
      expect(result.current.phase).toBe('idle');

      // Start signin
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.startSignin(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('processing_callback');
    });
  });

  describe('Utility Functions', () => {
    test('should clear errors', async () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Set an error first
      await act(async () => {
        await result.current.startSignin('' as any, testCallbackUrl);
      });

      expect(result.current.error).toBeTruthy();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should reset state', () => {
      const { result } = renderHook(() => useOAuthSignin());

      // Reset to initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.needsAdditionalScopes).toBe(false);
      expect(result.current.missingScopes).toEqual([]);
      expect(result.current.callbackMessage).toBeNull();
    });

    test('should provide debug info', () => {
      const { result } = renderHook(() => useOAuthSignin());

      const debugInfo = result.current.getDebugInfo();

      expect(debugInfo).toEqual({
        phase: 'idle',
        loading: false,
        error: null,
        provider: null,
        retryCount: 0,
        lastAttemptTimestamp: null,
        tempToken: null,
        accountId: null,
        accountName: null,
        needsAdditionalScopes: false,
        missingScopes: [],
        callbackMessage: null,
      });
    });
  });
});
