import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthSignup } from '../useOAuthSignup';
import { OAuthProviders } from '../../types';

// Mock AuthService
const mockAuthService = {
  generateOAuthSignupUrl: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useOAuthSignup', () => {
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
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isRedirecting).toBe(false);
      expect(result.current.isProcessingCallback).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should initialize OAuth-specific state', () => {
      const { result } = renderHook(() => useOAuthSignup({ autoProcessCallback: false }));

      expect(result.current.provider).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.callbackMessage).toBeNull();
      expect(result.current.canRetry).toBe(false);
    });

    test('should initialize progress tracking', () => {
      const { result } = renderHook(() => useOAuthSignup());

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to start OAuth signup');
      expect(result.current.nextStep).toBe('Choose OAuth provider');
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

      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Redirecting to google for signup...');
      });

      expect(result.current.phase).toBe('processing_callback');
      expect(result.current.provider).toBe(testProvider);
      expect(result.current.loading).toBe(false);
      expect(mockAuthService.generateOAuthSignupUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle signup initiation errors', async () => {
      const error = new Error('OAuth service unavailable');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to start google signup: OAuth service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to start google signup: OAuth service unavailable');
    });

    test('should update phase during signup initiation', async () => {
      let phaseBeforeRequest: string = '';

      mockAuthService.generateOAuthSignupUrl.mockImplementation(async () => {
        phaseBeforeRequest = result.current.phase;
        return {
          authorizationUrl: 'https://oauth.provider.com/auth',
          state: 'state-123',
          provider: 'google',
          authType: 'signup',
          callbackUrl: testCallbackUrl,
        };
      });

      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      expect(phaseBeforeRequest).toBe('redirecting');
      expect(result.current.phase).toBe('processing_callback');
    });

    test('should handle failed URL generation', async () => {
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: '', // Empty URL
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to generate OAuth signup URL');
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('Get Signup URL Flow', () => {
    test('should get signup URL without redirect', async () => {
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?client_id=...',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      const { result } = renderHook(() => useOAuthSignup());

      const url = await result.current.getSignupUrl(testProvider, testCallbackUrl);

      expect(url).toBe('https://accounts.google.com/oauth/authorize?client_id=...');
      expect(result.current.phase).toBe('idle'); // Should not change phase
      expect(mockAuthService.generateOAuthSignupUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });

    test('should handle get signup URL errors', async () => {
      const error = new Error('Failed to generate URL');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      const { result } = renderHook(() => useOAuthSignup());

      const url = await result.current.getSignupUrl(testProvider, testCallbackUrl);

      expect(url).toBe('');
      expect(result.current.error).toBe('Failed to get google signup URL: Failed to generate URL');
    });

    test('should validate get signup URL parameters', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // Test empty provider
      const url1 = await result.current.getSignupUrl('' as any, testCallbackUrl);
      expect(url1).toBe('');

      // Test empty callback URL
      const url2 = await result.current.getSignupUrl(testProvider, '');
      expect(url2).toBe('');
    });
  });

  describe('Callback Processing Flow', () => {
    test('should handle successful callback processing', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('OAuth callback processed successfully');
      });
    });

    test('should handle no callback data', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.processCallbackFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid callback found');
      });
    });
  });

  describe('Retry Logic', () => {
    test('should retry with cooldown', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown (5 seconds)
      vi.advanceTimersByTime(6000);

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
        expect(result.current.retryCount).toBe(1);
      });
    });

    test('should respect retry limits', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // Simulate being at max retries
      const error = new Error('Persistent error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.startSignup(testProvider, testCallbackUrl);
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
      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signup attempt to retry');
      });
    });

    test('should store last signup data for retry', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      // Clear mock and setup successful response
      mockAuthService.generateOAuthSignupUrl.mockClear();
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      // Advance time past cooldown
      vi.advanceTimersByTime(6000);

      // Retry should use stored data
      await act(async () => {
        await result.current.retry();
      });

      expect(mockAuthService.generateOAuthSignupUrl).toHaveBeenCalledWith(testProvider, {
        callbackUrl: testCallbackUrl,
      });
    });
  });

  describe('Progress and Phase Management', () => {
    test('should calculate progress correctly', () => {
      const { result } = renderHook(() => useOAuthSignup());

      expect(result.current.progress).toBe(0); // idle
      expect(result.current.currentStep).toBe('Ready to start OAuth signup');
      expect(result.current.nextStep).toBe('Choose OAuth provider');
    });

    test('should provide correct step descriptions', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // Initial state
      expect(result.current.currentStep).toBe('Ready to start OAuth signup');
      expect(result.current.nextStep).toBe('Choose OAuth provider');

      // After starting signup
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      // Progress should update based on phase
      expect(result.current.progress).toBeGreaterThan(0);
    });

    test('should transition through phases correctly', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // Initial state
      expect(result.current.phase).toBe('idle');

      // Start signup
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      expect(result.current.phase).toBe('processing_callback');
    });

    test('should update progress during different phases', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      // Initial progress
      expect(result.current.progress).toBe(0);

      // After starting signup
      mockAuthService.generateOAuthSignupUrl.mockResolvedValue({
        authorizationUrl: 'https://oauth.provider.com/auth',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: testCallbackUrl,
      });

      await act(async () => {
        await result.current.startSignup(testProvider, testCallbackUrl);
      });

      expect(result.current.progress).toBe(75); // processing_callback phase
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      const error = new Error('API service down');
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toContain('API service down');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toContain('API service down');
    });

    test('should handle network timeouts', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockAuthService.generateOAuthSignupUrl.mockRejectedValue(timeoutError);

      await act(async () => {
        const response = await result.current.startSignup(testProvider, testCallbackUrl);
        expect(response.success).toBe(false);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toContain('Request timeout');
    });

    test('should handle validation errors before API calls', async () => {
      const { result } = renderHook(() => useOAuthSignup());

      await act(async () => {
        const response = await result.current.startSignup(undefined as any, testCallbackUrl);
        expect(response.success).toBe(false);
        expect(response.message).toBe('OAuth provider is required');
      });

      // Should not make API call if validation fails
      expect(mockAuthService.generateOAuthSignupUrl).not.toHaveBeenCalled();
    });
  });
});
