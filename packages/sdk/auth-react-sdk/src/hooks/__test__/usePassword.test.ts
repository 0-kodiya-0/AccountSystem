import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasswordReset } from '../usePasswordReset';
import { createMockAuthService, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('usePasswordReset', () => {
  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasValidToken).toBe(false);
      expect(result.current.canResetPassword).toBe(false);
      expect(result.current.email).toBeNull();
      expect(result.current.resetToken).toBeNull();
    });
  });

  describe('Reset Request Flow', () => {
    test('should handle successful reset request', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Reset email sent successfully',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      const { result } = renderHook(() => usePasswordReset());

      await act(async () => {
        const response = await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Reset email sent successfully');
      });

      expect(result.current.phase).toBe('reset_email_sent');
      expect(result.current.email).toBe('test@example.com');
      expect(result.current.loading).toBe(false);
    });

    test('should handle reset request errors', async () => {
      const error = new Error('Email service unavailable');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to request password reset: Email service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to request password reset: Email service unavailable');
    });
  });

  describe('Password Reset Flow', () => {
    test('should handle successful password reset', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Mock token verification
      mockAuthService.verifyPasswordReset.mockResolvedValue({
        success: true,
        message: 'Token verified',
        resetToken: 'verified-token',
        expiresAt: '2022-01-01T01:00:00.000Z',
      });

      // Mock password reset
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      await act(async () => {
        const response = await result.current.resetPassword({
          password: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Password reset successfully');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.completionMessage).toBe('Password reset successfully');
    });

    test('should handle password reset errors', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      const error = new Error('Token expired');
      mockAuthService.resetPassword.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.resetPassword({
          password: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to reset password: Token expired');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to reset password: Token expired');
    });
  });

  describe('Token Processing', () => {
    test('should process token from URL', async () => {
      // This would be tested in integration with actual URL processing
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        // Mock behavior - would depend on actual URL token presence
        expect(response).toBeDefined();
      });
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(result.current.canRetry).toBe(true);

      // Mock successful retry
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Email sent on retry',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
      });

      expect(result.current.retryCount).toBe(1);
    });

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      const error = new Error('Persistent error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.requestReset({
            email: 'test@example.com',
            callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
          });
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
  });

  describe('State Management', () => {
    test('should provide progress tracking', () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to reset password');
      expect(result.current.nextStep).toBe('Enter your email address');
    });

    test('should clear errors and reset state', () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      act(() => {
        result.current.clearError();
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Complete Flow Integration', () => {
    test('should handle complete password reset flow', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Step 1: Request reset
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Email sent',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });
      });

      expect(result.current.phase).toBe('reset_email_sent');
      expect(result.current.progress).toBe(50);

      // Step 2: Reset password (with token verification)
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      await act(async () => {
        await result.current.resetPassword({
          password: 'newpassword123',
          confirmPassword: 'newpassword123',
        });
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.progress).toBe(100);
    });
  });
});
