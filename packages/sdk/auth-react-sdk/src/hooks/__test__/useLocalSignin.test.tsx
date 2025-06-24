import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalSignin } from '../useLocalSignin';
import { useAuthService } from '../../context/ServicesProvider';

// Mock the dependencies
vi.mock('../../context/ServicesProvider');
vi.mock('../../store/useAppStore');

describe('useLocalSignin', () => {
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      localLogin: vi.fn(),
      verifyTwoFactorLogin: vi.fn(),
    };

    (useAuthService as any).mockReturnValue(mockAuthService);
  });

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.requiresTwoFactor).toBe(false);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.completionMessage).toBeNull();
    });

    it('should have correct convenience getters for idle state', () => {
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.isIdle).toBe(true);
      expect(result.current.isSigningIn).toBe(false);
      expect(result.current.isRequires2FA).toBe(false);
      expect(result.current.isVerifying2FA).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
    });

    it('should have correct progress tracking for idle state', () => {
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.progress).toBe(0);
      expect(result.current.currentStep).toBe('Ready to sign in');
      expect(result.current.nextStep).toBe('Enter credentials');
    });
  });

  describe('signin', () => {
    it('should perform successful signin with email', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'password123',
      };
      const mockResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Login successful',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Login successful');
      expect(result.current.phase).toBe('completed');
      expect(result.current.accountId).toBe('507f1f77bcf86cd799439011');
      expect(result.current.accountName).toBe('John Doe');
      expect(result.current.completionMessage).toBe('Login successful');
      expect(result.current.isCompleted).toBe(true);
    });

    it('should perform successful signin with username', async () => {
      const loginData = {
        username: 'johndoe',
        password: 'password123',
      };
      const mockResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Login successful',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(true);
      expect(mockAuthService.localLogin).toHaveBeenCalledWith(loginData);
    });

    it('should handle signin that requires 2FA', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'password123',
      };
      const mockResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };

      mockAuthService.localLogin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Two-factor authentication required. Please enter your verification code.');
      expect(result.current.phase).toBe('requires_2fa');
      expect(result.current.requiresTwoFactor).toBe(true);
      expect(result.current.tempToken).toBe('temp-token-123');
      expect(result.current.accountId).toBe('507f1f77bcf86cd799439011');
      expect(result.current.accountName).toBe('John Doe');
    });

    it('should handle signin error', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'wrongpassword',
      };
      const error = new Error('Invalid credentials');

      mockAuthService.localLogin.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Signin failed: Invalid credentials');
      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Signin failed: Invalid credentials');
      expect(result.current.isFailed).toBe(true);
    });

    it('should validate email/username requirement', async () => {
      const loginData = {
        password: 'password123',
      };

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData as any);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Email or username is required');
      expect(result.current.error).toBe('Email or username is required');
    });

    it('should validate empty email', async () => {
      const loginData = {
        email: '',
        password: 'password123',
      };

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Email cannot be empty');
    });

    it('should validate empty username', async () => {
      const loginData = {
        username: '',
        password: 'password123',
      };

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Username cannot be empty');
    });

    it('should validate password requirement', async () => {
      const loginData = {
        email: 'john@example.com',
        password: '',
      };

      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.signin(loginData);
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Password is required');
    });
  });

  describe('verify2FA', () => {
    it('should verify 2FA successfully', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First set up the 2FA required state
      const loginData = { email: 'john@example.com', password: 'password123' };
      const loginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };
      mockAuthService.localLogin.mockResolvedValue(loginResponse);

      await act(async () => {
        await result.current.signin(loginData);
      });

      // Now verify 2FA
      const verifyResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Two-factor authentication successful!',
      };
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue(verifyResponse);

      let response: any;
      await act(async () => {
        response = await result.current.verify2FA('123456');
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Two-factor authentication successful!');
      expect(result.current.phase).toBe('completed');
      expect(result.current.completionMessage).toBe('Two-factor authentication successful!');
      expect(result.current.tempToken).toBeNull();
      expect(mockAuthService.verifyTwoFactorLogin).toHaveBeenCalledWith({
        token: '123456',
        tempToken: 'temp-token-123',
      });
    });

    it('should handle 2FA verification error', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First set up the 2FA required state
      const loginData = { email: 'john@example.com', password: 'password123' };
      const loginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };
      mockAuthService.localLogin.mockResolvedValue(loginResponse);

      await act(async () => {
        await result.current.signin(loginData);
      });

      // Now verify 2FA with error
      const error = new Error('Invalid 2FA code');
      mockAuthService.verifyTwoFactorLogin.mockRejectedValue(error);

      let response: any;
      await act(async () => {
        response = await result.current.verify2FA('123456');
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Two-factor verification failed: Invalid 2FA code');
      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Two-factor verification failed: Invalid 2FA code');
    });

    it('should validate 2FA token requirement', async () => {
      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.verify2FA('');
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Verification code is required');
    });

    it('should validate temp token availability', async () => {
      const { result } = renderHook(() => useLocalSignin());

      let response: any;
      await act(async () => {
        response = await result.current.verify2FA('123456');
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('No temporary token available. Please sign in again.');
    });
  });

  describe('retry', () => {
    it('should retry signin successfully', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First perform a failed signin
      const loginData = { email: 'john@example.com', password: 'password123' };
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValueOnce(error);

      await act(async () => {
        await result.current.signin(loginData);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.canRetry).toBe(true);

      // Now retry successfully
      const successResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Login successful',
      };
      mockAuthService.localLogin.mockResolvedValue(successResponse);

      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(true);
      expect(result.current.retryCount).toBe(1);
      expect(result.current.phase).toBe('completed');
    });

    it('should respect retry cooldown', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Perform a failed signin
      const loginData = { email: 'john@example.com', password: 'password123' };
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      await act(async () => {
        await result.current.signin(loginData);
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
      const { result } = renderHook(() => useLocalSignin());

      const loginData = { email: 'john@example.com', password: 'password123' };
      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      // Perform initial signin
      await act(async () => {
        await result.current.signin(loginData);
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

    it('should handle retry when no previous signin attempt', async () => {
      const { result } = renderHook(() => useLocalSignin());

      let retryResponse: any;
      await act(async () => {
        retryResponse = await result.current.retry();
      });

      expect(retryResponse.success).toBe(false);
      expect(retryResponse.message).toBe('No previous signin attempt to retry');
    });
  });

  describe('utility functions', () => {
    it('should clear error', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Set an error
      await act(async () => {
        await result.current.signin({ password: 'test' } as any);
      });

      expect(result.current.error).toBeTruthy();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset state', () => {
      const { result } = renderHook(() => useLocalSignin());

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
    });

    it('should return debug info', () => {
      const { result } = renderHook(() => useLocalSignin());

      const debugInfo = result.current.getDebugInfo();

      expect(debugInfo).toHaveProperty('phase');
      expect(debugInfo).toHaveProperty('loading');
      expect(debugInfo).toHaveProperty('error');
      expect(debugInfo).toHaveProperty('retryCount');
    });
  });

  describe('progress tracking', () => {
    it('should show correct progress for signing in', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const loginData = { email: 'john@example.com', password: 'password123' };

      // Mock a pending promise to test loading state
      let resolveLogin: any;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      mockAuthService.localLogin.mockReturnValue(loginPromise);

      act(() => {
        result.current.signin(loginData);
      });

      expect(result.current.phase).toBe('signing_in');
      expect(result.current.progress).toBe(30);
      expect(result.current.currentStep).toBe('Signing in...');
      expect(result.current.nextStep).toBe('Authenticating...');

      // Complete the login
      act(() => {
        resolveLogin({ accountId: '123', name: 'John', message: 'Success' });
      });
    });

    it('should show correct progress for 2FA required', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const loginData = { email: 'john@example.com', password: 'password123' };
      const loginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };
      mockAuthService.localLogin.mockResolvedValue(loginResponse);

      await act(async () => {
        await result.current.signin(loginData);
      });

      expect(result.current.progress).toBe(60);
      expect(result.current.currentStep).toBe('Two-factor authentication required');
      expect(result.current.nextStep).toBe('Enter verification code');
    });

    it('should show correct progress for completed signin', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const loginData = { email: 'john@example.com', password: 'password123' };
      const loginResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Login successful',
      };
      mockAuthService.localLogin.mockResolvedValue(loginResponse);

      await act(async () => {
        await result.current.signin(loginData);
      });

      expect(result.current.progress).toBe(100);
      expect(result.current.currentStep).toBe('Signin completed successfully!');
      expect(result.current.nextStep).toBeNull();
    });
  });
});
