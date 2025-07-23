import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthSignup } from '../useOAuthSignup';
import { createMockAuthService, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useOAuthSignup', () => {
  const testProvider = TEST_CONSTANTS.OAUTH.PROVIDER;
  const testCallbackUrl = TEST_CONSTANTS.OAUTH.CALLBACK_URL;

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('OAuth Signup Flow', () => {
    test('should handle successful signup initiation', async () => {
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for signup...');
      });

      expect(result.current.phase).toBe('processing_callback');
      expect(result.current.provider).toBe(testProvider);
      expect(mockAuthService.generateOAuthSignupUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle signup initiation errors', async () => {
      const error = new Error('OAuth service unavailable');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to start google signup: OAuth service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to start google signup: OAuth service unavailable');
    });

    test('should handle failed URL generation', async () => {
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: '', // Empty URL
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to generate OAuth signup URL');
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('URL Generation', () => {
    test('should get signup URL without redirect', async () => {
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const url = await result.current.getSignupUrl(testProvider, testCallbackUrl);
        expect(url).toBe('https://accounts.google.com/oauth/authorize?client_id=...');
      });

      expect(result.current.phase).toBe('idle'); // Should not change phase
    });

    test('should handle URL generation errors', async () => {
      const error = new Error('Failed to generate URL');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const url = await result.current.getSignupUrl(testProvider, testCallbackUrl);
        expect(url).toBe('');
      });

      expect(result.current.error).toBe('Failed to get google signup URL: Failed to generate URL');
    });

    test('should validate URL generation parameters', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        // Test empty provider
        const url1 = await result.current.getSignupUrl('' as any, testCallbackUrl);
        expect(url1).toBe('');

        // Test empty callback URL
        const url2 = await result.current.getSignupUrl(testProvider, '');
        expect(url2).toBe('');
      });
    });
  });

  describe('Callback Processing', () => {
    test('should handle callback processing', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });
    });

    test('should handle missing callback data', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(result.current.canRetry).toBe(true);

      // Mock successful retry
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
      });

      expect(result.current.retryCount).toBe(1);
    });

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      const error = new Error('Persistent error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.startSignup(testProvider, testCallbackUrl);
        });

        if (i < 2) {
          await act(async () => {
            vi.advanceTimersByTime(6000);
            await result.current.retry();
          });

          expect(result.current.retryCount).toBe(i + 1);
        }
      }

      // Should not allow more retries
      await act(async () => {
        vi.advanceTimersByTime(6000);
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('Maximum retry attempts (3) exceeded');
      });
    });

    test('should handle retry without previous attempt', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signup attempt to retry');
      });
    });
  });

  describe('Input Validation', () => {
    test('should validate signup parameters', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignup(undefined as any, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('OAuth provider is required');
      });

      expect(mockAuthService.generateOAuthSignupUrl).not.toHaveBeenCalled();
    });
  });
});
