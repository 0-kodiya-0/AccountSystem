import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasswordReset } from '../usePasswordReset';
import { useAuthService } from '../../context/ServicesProvider';

// Mock the dependencies
vi.mock('../../context/ServicesProvider');

// Mock window.location and history
const mockReplaceState = vi.fn();
Object.defineProperty(window, 'history', {
  value: { replaceState: mockReplaceState },
  writable: true,
});

describe('usePasswordReset', () => {
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      requestPasswordReset: vi.fn(),
      verifyPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    };

    (useAuthService as any).mockReturnValue(mockAuthService);

    // Reset URL parameters
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        href: 'http://localhost:3000',
      },
      writable: true,
    });

    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      const { result } = renderHook(() => usePasswordReset());

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.email).toBeNull();
      expect(result.current.resetToken).toBeNull();
      expect(result.current.completionMessage).toBeNull();
    });

    it('should have correct convenience getters for idle state', () => {
      const { result } = renderHook(() => usePasswordReset());

      expect(result.current.isIdle).toBe(true);
      expect(result.current.isRequestingReset).toBe(false);
      expect(result.current.isResetEmailSent).toBe(false);
      expect(result.current.isTokenVerifying).toBe(false);
      expect(result.current.isResettingPassword).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.hasValidToken).toBe(false);
      expect(result.current.canResetPassword).toBe(false);
    });

    it('should have correct progress tracking for idle state', () => {
      const { result } = renderHook(() => usePasswordReset());

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to reset password');
      expect(result.current.nextStep).toBe('Enter your email address');
    });

    it('should auto-process token from URL when autoProcessToken is true', async () => {
      window.location.search = '?token=reset-token-123';

      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: true }));

      // Wait for async token processing
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.verifyPasswordReset).toHaveBeenCalledWith({ token: 'reset-token-123' });
      expect(result.current.phase).toBe('token_verified');
      expect(result.current.resetToken).toBe('verified-reset-token');
      expect(mockReplaceState).toHaveBeenCalled();
    });

    it('should not auto-process token when autoProcessToken is false', async () => {
      window.location.search = '?token=reset-token-123';

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Wait a bit to ensure no processing happens
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(mockAuthService.verifyPasswordReset).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('requestReset', () => {
    it('should request password reset successfully', async () => {
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const mockResponse = {
        message: 'Password reset email sent successfully',
      };

      mockAuthService.requestPasswordReset.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePasswordReset());

      let response: any;
      await act(async () => {
        response = await result.current.requestReset(resetData);
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Password reset email sent successfully');
      expect(result.current.phase).toBe('reset_email_sent');
      expect(result.current.email).toBe('john@example.com');
      expect(result.current.loading).toBe(false);
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(resetData);
    });

    it('should handle request reset error', async () => {
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const error = new Error('Email service unavailable');

      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      const { result } = renderHook(() => usePasswordReset());

      let response: any;
      await act(async () => {
        response = await result.current.requestReset(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Failed to request password reset: Email service unavailable');
      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to request password reset: Email service unavailable');
    });

    it('should validate email requirement', async () => {
      const resetData = {
        email: '',
        callbackUrl: 'http://localhost:3000/reset',
      };

      const { result } = renderHook(() => usePasswordReset());

      let response: any;
      await act(async () => {
        response = await result.current.requestReset(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Email address is required');
      expect(result.current.error).toBe('Email address is required');
    });

    it('should validate callback URL requirement', async () => {
      const resetData = {
        email: 'john@example.com',
        callbackUrl: '',
      };

      const { result } = renderHook(() => usePasswordReset());

      let response: any;
      await act(async () => {
        response = await result.current.requestReset(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Callback URL is required');
    });
  });

  describe('token processing', () => {
    it('should process token from URL successfully', async () => {
      window.location.search = '?token=reset-token-123';

      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      let response: any;
      await act(async () => {
        response = await result.current.processTokenFromUrl();
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Reset token verified successfully');
      expect(result.current.phase).toBe('token_verified');
      expect(result.current.resetToken).toBe('verified-reset-token');
      expect(result.current.hasValidToken).toBe(true);
      expect(result.current.canResetPassword).toBe(true);
    });

    it('should handle invalid token', async () => {
      window.location.search = '?token=invalid-token';

      const error = new Error('Invalid or expired token');
      mockAuthService.verifyPasswordReset.mockRejectedValue(error);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      let response: any;
      await act(async () => {
        response = await result.current.processTokenFromUrl();
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('No valid reset token found');
      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Invalid reset token: Invalid or expired token');
    });

    it('should handle no token in URL', async () => {
      window.location.search = '';

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      let response: any;
      await act(async () => {
        response = await result.current.processTokenFromUrl();
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('No valid reset token found');
      expect(mockAuthService.verifyPasswordReset).not.toHaveBeenCalled();
    });

    it('should clean up URL after processing token', async () => {
      window.location.search = '?token=reset-token-123&other=param';

      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // First set up verified token state
      window.location.search = '?token=reset-token-123';
      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };
      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      // Now reset password
      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const mockResetResponse = {
        message: 'Password reset successfully',
      };

      mockAuthService.resetPassword.mockResolvedValue(mockResetResponse);

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Password reset successfully');
      expect(result.current.phase).toBe('completed');
      expect(result.current.completionMessage).toBe('Password reset successfully');
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('verified-reset-token', resetData);
    });

    it('should handle reset password error', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Set up verified token state
      window.location.search = '?token=reset-token-123';
      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };
      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      // Reset password with error
      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const error = new Error('Token expired');
      mockAuthService.resetPassword.mockRejectedValue(error);

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Failed to reset password: Token expired');
      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to reset password: Token expired');
    });

    it('should validate password requirement', async () => {
      const { result } = renderHook(() => usePasswordReset());

      const resetData = {
        password: '',
        confirmPassword: '',
      };

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('New password is required');
    });

    it('should validate password length', async () => {
      const { result } = renderHook(() => usePasswordReset());

      const resetData = {
        password: '123',
        confirmPassword: '123',
      };

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Password must be at least 8 characters long');
    });

    it('should validate password confirmation', async () => {
      const { result } = renderHook(() => usePasswordReset());

      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'differentPassword',
      };

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Passwords do not match');
    });

    it('should validate reset token availability', async () => {
      const { result } = renderHook(() => usePasswordReset());

      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      };

      let response: any;
      await act(async () => {
        response = await result.current.resetPassword(resetData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('No reset token available. Please request a new password reset.');
    });
  });

  describe('retry', () => {
    it('should retry password reset request successfully', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // First perform a failed request
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const error = new Error('Network error');
      mockAuthService.requestPasswordReset.mockRejectedValueOnce(error);

      await act(async () => {
        await result.current.requestReset(resetData);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(true);

      // Now retry successfully
      const successResponse = {
        message: 'Password reset email sent successfully',
      };
      mockAuthService.requestPasswordReset.mockResolvedValue(successResponse);

      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(true);
      expect(result.current.retryCount).toBe(1);
      expect(result.current.phase).toBe('reset_email_sent');
    });

    it('should respect retry cooldown', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // Perform a failed request
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const error = new Error('Network error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      await act(async () => {
        await result.current.requestReset(resetData);
      });

      // Immediately try to retry (should be rejected due to cooldown)
      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(false);
      expect(retryResponse.message).toContain('Please wait');
    });

    it('should respect maximum retry attempts', async () => {
      const { result } = renderHook(() => usePasswordReset());

      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const error = new Error('Network error');
      mockAuthService.requestPasswordReset.mockRejectedValue(error);

      // Perform initial request
      await act(async () => {
        await result.current.requestReset(resetData);
      });

      // Simulate multiple retries by manipulating state
      await act(async () => {
        // Simulate 3 failed retries
        for (let i = 0; i < 3; i++) {
          try {
            await result.current.retry();
          } catch (e) {
            // Ignore retry failures for this test
          }
        }
      });

      // Should now exceed max attempts
      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(false);
      expect(retryResponse.message).toContain('Maximum retry attempts');
    });

    it('should handle retry when no previous request', async () => {
      const { result } = renderHook(() => usePasswordReset());

      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(false);
      expect(retryResponse.message).toBe('No previous operation to retry');
    });
  });

  describe('utility functions', () => {
    it('should clear error', async () => {
      const { result } = renderHook(() => usePasswordReset());

      // Set an error
      await act(async () => {
        await result.current.requestReset({ email: '', callbackUrl: 'test' });
      });

      expect(result.current.error).toBeTruthy();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset state', () => {
      const { result } = renderHook(() => usePasswordReset());

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.email).toBeNull();
      expect(result.current.resetToken).toBeNull();
    });

    it('should return debug info', () => {
      const { result } = renderHook(() => usePasswordReset());

      const debugInfo = result.current.getDebugInfo();

      expect(debugInfo).toHaveProperty('phase');
      expect(debugInfo).toHaveProperty('loading');
      expect(debugInfo).toHaveProperty('error');
      expect(debugInfo).toHaveProperty('retryCount');
      expect(debugInfo).toHaveProperty('email');
      expect(debugInfo).toHaveProperty('resetToken');
    });
  });

  describe('progress tracking', () => {
    it('should show correct progress for reset email sent', async () => {
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const mockResponse = {
        message: 'Password reset email sent successfully',
      };

      mockAuthService.requestPasswordReset.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePasswordReset());

      await act(async () => {
        await result.current.requestReset(resetData);
      });

      expect(result.current.progress).toBe(50);
      expect(result.current.currentStep).toBe('Reset email sent');
      expect(result.current.nextStep).toBe('Click the link in your email');
    });

    it('should show correct progress for token verified', async () => {
      window.location.search = '?token=reset-token-123';

      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(result.current.progress).toBe(60);
      expect(result.current.currentStep).toBe('Verifying reset token...');
      expect(result.current.nextStep).toBe('Enter new password');
    });

    it('should show correct progress for completed reset', async () => {
      const { result } = renderHook(() => usePasswordReset({ autoProcessToken: false }));

      // Set up verified token state
      window.location.search = '?token=reset-token-123';
      const mockVerifyResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };
      mockAuthService.verifyPasswordReset.mockResolvedValue(mockVerifyResponse);

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      // Complete password reset
      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const mockResetResponse = {
        message: 'Password reset successfully',
      };
      mockAuthService.resetPassword.mockResolvedValue(mockResetResponse);

      await act(async () => {
        await result.current.resetPassword(resetData);
      });

      expect(result.current.progress).toBe(100);
      expect(result.current.currentStep).toBe('Password reset successfully!');
      expect(result.current.nextStep).toBeNull();
    });
  });
});
