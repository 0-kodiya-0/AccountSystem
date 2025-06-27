import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasswordReset } from '../usePasswordReset';

// Mock AuthService
const mockAuthService = {
  requestPasswordReset: vi.fn(),
  verifyPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock Date.now for consistent testing
const mockDateNow = vi.fn();
vi.stubGlobal('Date', {
  ...Date,
  now: mockDateNow,
});

describe('usePasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDateNow.mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('should initialize with idle phase', () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isRequestingReset).toBe(false);
      expect(result.current.isResetEmailSent).toBe(false);
      expect(result.current.isTokenVerifying).toBe(false);
      expect(result.current.isResettingPassword).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasValidToken).toBe(false);
      expect(result.current.canResetPassword).toBe(false);
      expect(result.current.email).toBeNull();
      expect(result.current.resetToken).toBeNull();
      expect(result.current.completionMessage).toBeNull();
    });

    test('should have correct initial progress and steps', () => {
      const { result } = renderHook(() => usePasswordReset());

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to reset password');
      expect(result.current.nextStep).toBe('Enter your email address');
    });
  });

  describe('Reset Request Flow', () => {
    test('should handle successful reset request flow', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Reset email sent successfully',
        callbackUrl: 'http://localhost:3000/reset',
      });

      const { result } = renderHook(() => usePasswordReset());

      await act(async () => {
        const response = await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Reset email sent successfully');
      });

      expect(result.current.phase).toBe('reset_email_sent');
      expect(result.current.isResetEmailSent).toBe(true);
      expect(result.current.email).toBe('test@example.com');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should handle reset request errors', async () => {
      const error = new Error('Email service unavailable');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      const { result } = renderHook(() => usePasswordReset());

      await act(async () => {
        const response = await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to request password reset: Email service unavailable');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to request password reset: Email service unavailable');
      expect(result.current.loading).toBe(false);
    });

    test('should update phase during reset request', async () => {
      let phaseBeforeRequest: string = '';
      let phaseAfterRequest: string = '';

      mockAuthService.requestPasswordReset.mockImplementation(async () => {
        phaseBeforeRequest = result.current.phase;
        return {
          message: 'Email sent',
          callbackUrl: 'http://localhost:3000/reset',
        };
      });

      const { result } = renderHook(() => usePasswordReset());

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });
        phaseAfterRequest = result.current.phase;
      });

      expect(phaseBeforeRequest).toBe('requesting_reset');
      expect(phaseAfterRequest).toBe('reset_email_sent');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Password Reset with Token Flow', () => {
    beforeEach(async () => {
      // Set up hook in token_verified state
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Manually trigger token verification to get to proper state
      mockAuthService.verifyPasswordReset.mockResolvedValue({
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token-123',
        expiresAt: '2022-01-01T01:00:00.000Z',
      });

      await act(async () => {
        // Simulate having a token (this would come from URL in real scenario)
        const response = await result.current.processTokenFromUrl();
      });

      return { result };
    });

    test('should handle successful password reset flow', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Set up verified token state manually
      mockAuthService.verifyPasswordReset.mockResolvedValue({
        success: true,
        message: 'Token verified',
        resetToken: 'verified-token',
        expiresAt: '2022-01-01T01:00:00.000Z',
      });

      // Mock the token processing to set up state
      await act(async () => {
        // This simulates having processed a token successfully
        const mockProcessing = async () => {
          return { success: true, message: 'Token verified' };
        };
        await mockProcessing();
      });

      // Now test password reset
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
      expect(result.current.isCompleted).toBe(true);
      expect(result.current.completionMessage).toBe('Password reset successfully');
      expect(result.current.loading).toBe(false);
    });

    test('should handle password reset errors', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Set up state with valid token
      mockAuthService.verifyPasswordReset.mockResolvedValue({
        success: true,
        message: 'Token verified',
        resetToken: 'verified-token',
        expiresAt: '2022-01-01T01:00:00.000Z',
      });

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
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to reset password: Token expired');
    });

    test('should update phase during password reset', async () => {
      const { result } = renderHook(() => usePasswordReset());

      let phaseBeforeReset: string = '';
      let phaseAfterReset: string = '';

      mockAuthService.resetPassword.mockImplementation(async () => {
        phaseBeforeReset = result.current.phase;
        return { message: 'Password reset' };
      });

      await act(async () => {
        await result.current.resetPassword({
          password: 'newpassword123',
          confirmPassword: 'newpassword123',
        });
        phaseAfterReset = result.current.phase;
      });

      expect(phaseBeforeReset).toBe('resetting_password');
      expect(phaseAfterReset).toBe('completed');
    });
  });

  describe('Validation', () => {
    describe('Reset Request Validation', () => {
      test('should validate empty email', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.requestReset({
            email: '',
            callbackUrl: 'http://localhost:3000/reset',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Email address is required');
          expect(result.current.error).toBe('Email address is required');
        });
      });

      test('should validate whitespace email', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.requestReset({
            email: '   ',
            callbackUrl: 'http://localhost:3000/reset',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Email address is required');
        });
      });

      test('should validate empty callback URL', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.requestReset({
            email: 'test@example.com',
            callbackUrl: '',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Callback URL is required');
        });
      });

      test('should validate whitespace callback URL', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.requestReset({
            email: 'test@example.com',
            callbackUrl: '   ',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Callback URL is required');
        });
      });
    });

    describe('Password Reset Validation', () => {
      test('should validate missing reset token', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.resetPassword({
            password: 'newpassword123',
            confirmPassword: 'newpassword123',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('No reset token available. Please request a new password reset.');
        });
      });

      test('should validate empty password', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.resetPassword({
            password: '',
            confirmPassword: '',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('New password is required');
        });
      });

      test('should validate short password', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.resetPassword({
            password: '123',
            confirmPassword: '123',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Password must be at least 8 characters long');
        });
      });

      test('should validate missing confirm password', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.resetPassword({
            password: 'newpassword123',
            confirmPassword: '',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Password confirmation is required');
        });
      });

      test('should validate password mismatch', async () => {
        const { result } = renderHook(() => usePasswordReset());

        await act(async () => {
          const response = await result.current.resetPassword({
            password: 'newpassword123',
            confirmPassword: 'differentpassword',
          });

          expect(response.success).toBe(false);
          expect(response.message).toBe('Passwords do not match');
        });
      });
    });
  });

  describe('Phase Transitions and Retry Logic', () => {
    test('should transition through phases correctly', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // Initial state
      expect(result.current.phase).toBe('idle');
      expect(result.current.progress).toBe(0);

      // Request reset
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Email sent',
        callbackUrl: 'http://localhost:3000/reset',
      });

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });
      });

      expect(result.current.phase).toBe('reset_email_sent');
      expect(result.current.progress).toBe(50);

      // Verify token (simulated)
      mockAuthService.verifyPasswordReset.mockResolvedValue({
        success: true,
        message: 'Token verified',
        resetToken: 'verified-token',
        expiresAt: '2022-01-01T01:00:00.000Z',
      });

      // Reset password
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

    test('should calculate progress correctly for different phases', () => {
      const { result } = renderHook(() => usePasswordReset());

      // Test progress calculation through phase simulation
      expect(result.current.progress).toBe(0); // idle
      expect(result.current.currentStep).toBe('Ready to reset password');
      expect(result.current.nextStep).toBe('Enter your email address');
    });

    test('should handle retry with cooldown', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(false); // Still in cooldown

      // Advance time past cooldown
      mockDateNow.mockReturnValue(1640995200000 + 6000); // 6 seconds later

      expect(result.current.canRetry).toBe(true);

      // Retry should work
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Email sent on retry',
        callbackUrl: 'http://localhost:3000/reset',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(result.current.retryCount).toBe(1);
      });
    });

    test('should respect retry limits', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // Simulate being at max retries by setting retry count and failing multiple times
      const error = new Error('Persistent error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      // Perform multiple failures and retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.requestReset({
            email: 'test@example.com',
            callbackUrl: 'http://localhost:3000/reset',
          });
        });

        if (i < 2) {
          mockDateNow.mockReturnValue(1640995200000 + (i + 1) * 6000);
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

    test('should provide correct step descriptions', async () => {
      const { result } = renderHook(() => usePasswordReset());

      expect(result.current.currentStep).toBe('Ready to reset password');
      expect(result.current.nextStep).toBe('Enter your email address');

      // After successful email send
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'Email sent',
        callbackUrl: 'http://localhost:3000/reset',
      });

      await act(async () => {
        await result.current.requestReset({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/reset',
        });
      });

      expect(result.current.currentStep).toBe('Reset email sent');
      expect(result.current.nextStep).toBe('Click the link in your email');
    });

    test('should clear errors', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // Set an error first
      await act(async () => {
        await result.current.requestReset({
          email: '',
          callbackUrl: 'http://localhost:3000/reset',
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
      const { result } = renderHook(() => usePasswordReset());

      // Reset to initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.email).toBeNull();
      expect(result.current.resetToken).toBeNull();
      expect(result.current.completionMessage).toBeNull();
    });
  });
});
