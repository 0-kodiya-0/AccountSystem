import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthSignin } from '../useOAuthSignin';
import { createMockAuthService, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useOAuthSignin', () => {
  const testProvider = TEST_CONSTANTS.OAUTH.PROVIDER;
  const testCallbackUrl = TEST_CONSTANTS.OAUTH.CALLBACK_URL;

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.requiresTwoFactor).toBe(false);
      expect(result.current.tempToken).toBeNull();
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

      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for signin...');
      });

      expect(result.current.phase).toBe('processing_callback');
      expect(result.current.provider).toBe(testProvider);
      expect(mockAuthService.generateOAuthSigninUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle signin initiation errors', async () => {
      const error = new Error('OAuth service unavailable');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to start google signin: OAuth service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to start google signin: OAuth service unavailable');
    });

    test('should handle failed URL generation', async () => {
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: '', // Empty URL
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignin(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to generate OAuth signin URL');
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('2FA Verification Flow', () => {
    test('should handle successful 2FA verification', async () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: '2FA verification successful',
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA verification successful');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.tempToken).toBeNull();
      expect(result.current.callbackMessage).toBe('2FA verification successful');
    });

    test('should handle 2FA verification with additional scopes needed', async () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: '2FA successful, additional permissions needed',
        needsAdditionalScopes: true,
        missingScopes: TEST_CONSTANTS.OAUTH.SCOPES,
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(true);
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.needsAdditionalScopes).toBe(true);
      expect(result.current.missingScopes).toEqual(TEST_CONSTANTS.OAUTH.SCOPES);
    });

    test('should validate 2FA inputs', async () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      // Test empty token
      await act(async () => {
        const response = await result.current.verify2FA('');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Verification code is required');
      });

      // Test missing temp token
      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(false);
        expect(response.message).toBe('No temporary token available. Please sign in again.');
      });
    });
  });

  describe('URL Generation', () => {
    test('should get signin URL without redirect', async () => {
      mockAuthService.generateOAuthSigninUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      const url = await result.current.getSigninUrl(testProvider, testCallbackUrl);

      expect(url).toBe('https://accounts.google.com/oauth/authorize?client_id=...');
      expect(result.current.phase).toBe('idle'); // Should not change phase
    });

    test('should handle URL generation errors', async () => {
      const error = new Error('Failed to generate URL');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      const url = await result.current.getSigninUrl(testProvider, testCallbackUrl);

      expect(url).toBe('');
      expect(result.current.error).toBe('Failed to get google signin URL: Failed to generate URL');
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism', async () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignin(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

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

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      const error = new Error('Persistent error');
      mockAuthService.generateOAuthSigninUrl.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.startSignin(testProvider, testCallbackUrl);
        });

        if (i < 2) {
          await act(async () => {
            vi.advanceTimersByTime(6000);
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
      const { result } = renderHook(() => useOAuthSignin({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signin attempt to retry');
      });
    });
  });
});
