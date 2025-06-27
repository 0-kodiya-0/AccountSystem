import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalSignin } from '../useLocalSignin';
import { LocalLoginRequest, LocalLoginResponse } from '../../types';

// Mock AuthService
const mockAuthService = {
  localLogin: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useLocalSignin', () => {
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
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isSigningIn).toBe(false);
      expect(result.current.isRequires2FA).toBe(false);
      expect(result.current.isVerifying2FA).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
    });

    test('should have correct initial state', () => {
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.requiresTwoFactor).toBe(false);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.completionMessage).toBeNull();
      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to sign in');
      expect(result.current.nextStep).toBe('Enter credentials');
    });
  });

  describe('Signin Validation and Flow', () => {
    test('should validate signin data - missing email and username', async () => {
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          password: 'password123',
        } as LocalLoginRequest);

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email or username is required');
        expect(result.current.error).toBe('Email or username is required');
      });
    });

    test('should validate signin data - empty email', async () => {
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          email: '',
          password: 'password123',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email cannot be empty');
      });
    });

    test('should validate signin data - empty username', async () => {
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          username: '   ',
          password: 'password123',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Username cannot be empty');
      });
    });

    test('should validate signin data - missing password', async () => {
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          email: 'test@example.com',
          password: '',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Password is required');
      });
    });

    test('should handle successful signin', async () => {
      const mockResponse: LocalLoginResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Signin successful!',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Signin successful!');
        expect(result.current.phase).toBe('completed');
        expect(result.current.accountId).toBe('507f1f77bcf86cd799439011');
        expect(result.current.accountName).toBe('John Doe');
        expect(result.current.completionMessage).toBe('Signin successful!');
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle signin requiring 2FA', async () => {
      const mockResponse: LocalLoginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Two-factor authentication required. Please enter your verification code.');
        expect(result.current.phase).toBe('requires_2fa');
        expect(result.current.requiresTwoFactor).toBe(true);
        expect(result.current.tempToken).toBe('temp-token-123');
        expect(result.current.accountId).toBe('507f1f77bcf86cd799439011');
        expect(result.current.accountName).toBe('John Doe');
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle signin errors', async () => {
      const error = new Error('Invalid credentials');
      mockAuthService.localLogin.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.signin({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Signin failed: Invalid credentials');
        expect(result.current.phase).toBe('failed');
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBe('Signin failed: Invalid credentials');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('2FA Validation and Flow', () => {
    beforeEach(async () => {
      // Set up hook in 2FA required state
      const mockResponse: LocalLoginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);
    });

    test('should validate 2FA token - empty token', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First sign in to get to 2FA state
      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Try to verify with empty token
      await act(async () => {
        const response = await result.current.verify2FA('');

        expect(response.success).toBe(false);
        expect(response.message).toBe('Verification code is required');
        expect(result.current.error).toBe('Verification code is required');
      });
    });

    test('should validate 2FA token - no temp token', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Try to verify without being in 2FA state
      await act(async () => {
        const response = await result.current.verify2FA('123456');

        expect(response.success).toBe(false);
        expect(response.message).toBe('No temporary token available. Please sign in again.');
      });
    });

    test('should handle successful 2FA verification', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First sign in to get to 2FA state
      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Mock successful 2FA verification
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Two-factor authentication successful!',
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');

        expect(response.success).toBe(true);
        expect(response.message).toBe('Two-factor authentication successful!');
        expect(result.current.phase).toBe('completed');
        expect(result.current.isCompleted).toBe(true);
        expect(result.current.tempToken).toBeNull();
        expect(result.current.completionMessage).toBe('Two-factor authentication successful!');
      });
    });

    test('should handle 2FA verification errors', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First sign in to get to 2FA state
      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Mock failed 2FA verification
      const error = new Error('Invalid verification code');
      mockAuthService.verifyTwoFactorLogin.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verify2FA('wrongcode');

        expect(response.success).toBe(false);
        expect(response.message).toBe('Two-factor verification failed: Invalid verification code');
        expect(result.current.phase).toBe('failed');
        expect(result.current.isFailed).toBe(true);
      });
    });
  });

  describe('Retry Logic', () => {
    test('should retry with cooldown', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Simulate failed signin
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown (5 seconds)
      vi.advanceTimersByTime(6000);

      // Now should be able to retry
      expect(result.current.canRetry).toBe(true);

      // Mock successful retry
      mockAuthService.localLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Signin successful!',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(result.current.retryCount).toBe(1);
      });
    });

    test('should respect retry limits', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const signinData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Simulate network error for all attempts
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      // Perform first attempt
      await act(async () => {
        await result.current.signin(signinData);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.retryCount).toBe(0);

      // Perform retries up to the limit
      for (let i = 1; i <= 3; i++) {
        // Advance time past cooldown
        vi.advanceTimersByTime(6000);

        await act(async () => {
          const response = await result.current.retry();
          if (i < 3) {
            expect(response.success).toBe(false);
            expect(result.current.retryCount).toBe(i);
          } else {
            // On the 3rd retry, it should still fail but with max retries reached
            expect(response.success).toBe(false);
            expect(result.current.retryCount).toBe(3);
          }
        });
      }

      // Try one more retry - should be blocked
      vi.advanceTimersByTime(6000); // Advance past cooldown

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('Maximum retry attempts (3) exceeded');
      });
    });

    test('should enforce cooldown period', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Simulate failed signin
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Try to retry immediately (should be blocked by cooldown)
      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toMatch(/Please wait \d+ seconds before retrying/);
      });

      // Advance time but not enough (3 seconds, cooldown is 5s)
      vi.advanceTimersByTime(3000);

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toMatch(/Please wait \d+ seconds before retrying/);
      });

      // Advance past cooldown
      vi.advanceTimersByTime(3000); // Total 6 seconds

      // Mock successful retry
      mockAuthService.localLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Signin successful!',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
      });
    });

    test('should store last signin data for retry', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const signinData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Fail initial signin
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      await act(async () => {
        await result.current.signin(signinData);
      });

      // Clear mock and setup successful response
      mockAuthService.localLogin.mockClear();
      mockAuthService.localLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Signin successful!',
      });

      // Advance time past cooldown
      vi.advanceTimersByTime(6000);

      // Retry should use stored data
      await act(async () => {
        await result.current.retry();
      });

      expect(mockAuthService.localLogin).toHaveBeenCalledWith(signinData);
    });

    test('should handle retry without previous attempt', async () => {
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signin attempt to retry');
      });
    });
  });

  describe('Phase Transitions', () => {
    test('should transition through phases correctly', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Initial state
      expect(result.current.phase).toBe('idle');

      // Start signin
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp-token',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Should be in 2FA required state
      expect(result.current.phase).toBe('requires_2fa');

      // Complete 2FA
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Success!',
      });

      await act(async () => {
        await result.current.verify2FA('123456');
      });

      // Should be completed
      expect(result.current.phase).toBe('completed');
    });

    test('should calculate progress correctly for different phases', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Initial phase
      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to sign in');

      // After 2FA required
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp-token',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(result.current.progress).toBe(60);
      expect(result.current.currentStep).toBe('Two-factor authentication required');
      expect(result.current.nextStep).toBe('Enter verification code');

      // After completion
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Success!',
      });

      await act(async () => {
        await result.current.verify2FA('123456');
      });

      expect(result.current.progress).toBe(100);
      expect(result.current.currentStep).toBe('Signin completed successfully!');
      expect(result.current.nextStep).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    test('should clear errors', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Set an error first
      await act(async () => {
        await result.current.signin({
          email: '',
          password: 'password123',
        });
      });

      expect(result.current.error).toBeTruthy();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should reset state', () => {
      const { result } = renderHook(() => useLocalSignin());

      // Reset to initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.completionMessage).toBeNull();
    });

    test('should provide debug info', () => {
      const { result } = renderHook(() => useLocalSignin());

      const debugInfo = result.current.getDebugInfo();

      expect(debugInfo).toEqual({
        phase: 'idle',
        loading: false,
        error: null,
        retryCount: 0,
        lastAttemptTimestamp: null,
        tempToken: null,
        accountId: null,
        accountName: null,
        completionMessage: null,
      });
    });
  });
});
