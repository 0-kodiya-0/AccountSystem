import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthSignup } from '../useOAuthSignup';
import { CallbackCode } from '../../types';
import { createMockAuthService, setupBrowserMocks, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useOAuthSignup', () => {
  const testProvider = TEST_CONSTANTS.OAUTH.PROVIDER;
  const testCallbackUrl = TEST_CONSTANTS.OAUTH.CALLBACK_URL;
  let mockLocation: ReturnType<typeof setupBrowserMocks>['mockLocation'];
  let mockHistory: ReturnType<typeof setupBrowserMocks>['mockHistory'];

  beforeEach(() => {
    const browserMocks = setupBrowserMocks();
    mockLocation = browserMocks.mockLocation;
    mockHistory = browserMocks.mockHistory;
  });

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
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
        expect(url).toBe(null);
      });

      expect(result.current.error).toBe('Failed to get google signup URL: Failed to generate URL');
    });

    test('should validate URL generation parameters', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        // Test empty provider
        const url1 = await result.current.getSignupUrl('' as any, testCallbackUrl);
        expect(url1).toBe(null);

        // Test empty callback URL
        const url2 = await result.current.getSignupUrl(testProvider, '');
        expect(url2).toBe(null);
      });
    });
  });

  describe('Callback Processing', () => {
    test('should process successful callback from URL', async () => {
      // Mock URL with successful callback parameters
      mockLocation.search = `?code=${CallbackCode.OAUTH_SIGNUP_SUCCESS}&accountId=${TEST_CONSTANTS.ACCOUNT_IDS.CURRENT}&name=John%20Doe&message=Signup%20successful`;
      mockLocation.href = `http://localhost:3000?code=${CallbackCode.OAUTH_SIGNUP_SUCCESS}&accountId=${TEST_CONSTANTS.ACCOUNT_IDS.CURRENT}&name=John%20Doe&message=Signup%20successful`;

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.accountId).toBe(TEST_CONSTANTS.ACCOUNT_IDS.CURRENT);
      expect(result.current.accountName).toBe('John Doe');
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    test('should handle callback processing errors', async () => {
      // Mock URL with error callback
      mockLocation.search = `?code=${CallbackCode.OAUTH_ERROR}&error=Registration%20failed`;
      mockLocation.href = `http://localhost:3000?code=${CallbackCode.OAUTH_ERROR}&error=Registration%20failed`;

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Registration failed');
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    test('should handle missing callback data', async () => {
      // Mock URL without callback parameters
      mockLocation.search = '';
      mockLocation.href = 'http://localhost:3000';

      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });

      expect(result.current.phase).toBe('idle'); // Should remain idle
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism for signup', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
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

      expect(result.current.retryCount).toBe(0); // Reset to 0 on successful retry
      expect(result.current.phase).toBe('processing_callback');
    });

    test('should handle retry for callback processing', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      // Set up callback that will fail
      mockLocation.search = `?code=${CallbackCode.OAUTH_ERROR}&error=Server%20error`;

      await act(async () => {
        await result.current.processCallbackFromUrl();
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful callback retry by changing the URL
      mockLocation.search = `?code=${CallbackCode.OAUTH_SIGNUP_SUCCESS}&accountId=${TEST_CONSTANTS.ACCOUNT_IDS.CURRENT}&name=John%20Doe`;

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback retry successful');
      });

      expect(result.current.phase).toBe('completed');
    });

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      const error = new Error('Persistent error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      // Initial attempt fails
      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
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
          expect(response.message).toBe('Failed to start google signup: Persistent error');
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

    test('should validate callback URL parameter', async () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      await act(async () => {
        const response = await result.current.startSignup(testProvider, '');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Callback URL is required');
      });

      expect(mockAuthService.generateOAuthSignupUrl).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    test('should properly reset state and clear retry data', () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.provider).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.callbackMessage).toBeNull();
    });

    test('should provide correct progress values for different phases', () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      // Initial state
      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to start OAuth signup');
      expect(result.current.nextStep).toBe('Choose OAuth provider');
    });
  });
});
