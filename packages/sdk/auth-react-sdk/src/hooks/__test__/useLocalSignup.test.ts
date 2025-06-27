import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalSignup } from '../useLocalSignup';

// Mock AuthService
const mockAuthService = {
  requestEmailVerification: vi.fn(),
  verifyEmailForSignup: vi.fn(),
  completeProfile: vi.fn(),
  cancelSignup: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock window.location and window.history
const mockLocation = {
  href: 'http://localhost:3000',
  search: '',
  origin: 'http://localhost:3000',
};

const mockHistory = {
  replaceState: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true,
});

describe('useLocalSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
    mockLocation.href = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('should initialize with idle phase', () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isEmailSending).toBe(false);
      expect(result.current.isEmailSent).toBe(false);
      expect(result.current.isEmailVerifying).toBe(false);
      expect(result.current.isEmailVerified).toBe(false);
      expect(result.current.isProfileCompleting).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isCanceled).toBe(false);
      expect(result.current.isFailed).toBe(false);
    });

    test('should process token from URL automatically', async () => {
      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified successfully',
        profileToken: 'profile-token-123',
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: true }));

      // Wait for useEffect to process token
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.verifyEmailForSignup).toHaveBeenCalledWith('verification-token-123');
      expect(result.current.phase).toBe('email_verified');
      expect(result.current.isEmailVerified).toBe(true);
    });

    test('should respect autoProcessToken option', async () => {
      mockLocation.search = '?token=verification-token-123';

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Wait to ensure no automatic processing
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.verifyEmailForSignup).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('Email Verification Request Validation', () => {
    test('should validate email verification request - empty email', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: '',
          callbackUrl: 'http://localhost:3000/verify',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email address is required');
        expect(result.current.error).toBe('Email address is required');
      });
    });

    test('should validate email verification request - empty callback URL', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: '',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Callback URL is required');
        expect(result.current.error).toBe('Callback URL is required');
      });
    });

    test('should validate email verification request - whitespace email', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: '   ',
          callbackUrl: 'http://localhost:3000/verify',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email address is required');
      });
    });

    test('should validate email verification request - whitespace callback URL', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: '   ',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Callback URL is required');
      });
    });

    test('should handle successful email send', async () => {
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Verification email sent successfully',
        email: 'test@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      });

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Verification email sent successfully');
        expect(result.current.phase).toBe('email_sent');
        expect(result.current.isEmailSent).toBe(true);
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle email send errors', async () => {
      const error = new Error('Email service unavailable');
      mockAuthService.requestEmailVerification.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to send verification email: Email service unavailable');
        expect(result.current.phase).toBe('failed');
        expect(result.current.isFailed).toBe(true);
        expect(result.current.error).toBe('Failed to send verification email: Email service unavailable');
      });
    });
  });

  describe('Token Processing', () => {
    test('should extract token from URL', async () => {
      mockLocation.search = '?token=test-token-123&other=param';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified',
        profileToken: 'profile-token-123',
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Email verification successful');
      });

      expect(mockAuthService.verifyEmailForSignup).toHaveBeenCalledWith('test-token-123');
    });

    test('should verify token with API', async () => {
      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified successfully',
        profileToken: 'profile-token-123',
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(result.current.phase).toBe('email_verified');
      expect(result.current.isEmailVerified).toBe(true);
    });

    test('should handle invalid tokens', async () => {
      mockLocation.search = '?token=invalid-token';
      const error = new Error('Invalid verification token');
      mockAuthService.verifyEmailForSignup.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid token found');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Email verification failed: Invalid verification token');
    });

    test('should clean URL after processing', async () => {
      mockLocation.search = '?token=test-token-123';
      mockLocation.href = 'http://localhost:3000?token=test-token-123';

      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified',
        profileToken: 'profile-token-123',
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000');
    });

    test('should handle no token in URL', async () => {
      mockLocation.search = '';

      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid token found');
      });

      expect(mockAuthService.verifyEmailForSignup).not.toHaveBeenCalled();
    });
  });

  describe('Profile Completion', () => {
    beforeEach(async () => {
      // Set up hook in email_verified state
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified',
        profileToken: 'profile-token-123',
        email: 'test@example.com',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      return { result };
    });

    test('should validate profile data - missing firstName', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Manually set to email_verified state
      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: '',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('First name is required');
      });
    });

    test('should validate profile data - missing lastName', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: '   ',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Last name is required');
      });
    });

    test('should validate profile data - short password', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: '123',
          confirmPassword: '123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Password must be at least 8 characters long');
      });
    });

    test('should validate profile data - passwords do not match', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'differentpassword',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Passwords do not match');
      });
    });

    test('should validate profile data - terms not agreed', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: false,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('You must agree to the terms and conditions');
      });
    });

    test('should validate profile data - no profile token', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('No profile token available. Please verify your email first.');
      });
    });

    test('should handle successful profile completion', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      mockAuthService.completeProfile.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Account created successfully',
      });

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(true);
        expect(response.accountId).toBe('507f1f77bcf86cd799439011');
        expect(response.message).toBe('Welcome John Doe! Your account has been created successfully.');
        expect(result.current.phase).toBe('completed');
        expect(result.current.isCompleted).toBe(true);
      });
    });

    test('should handle profile completion errors', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      mockLocation.search = '?token=verification-token-123';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token-123',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      const error = new Error('Username already taken');
      mockAuthService.completeProfile.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to complete profile: Username already taken');
        expect(result.current.phase).toBe('failed');
        expect(result.current.isFailed).toBe(true);
      });
    });
  });

  describe('Cancellation', () => {
    test('should cancel signup process', async () => {
      const { result } = renderHook(() => useLocalSignup());

      // First start signup process
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });
      });

      // Now cancel
      mockAuthService.cancelSignup.mockResolvedValue({
        message: 'Signup canceled successfully',
      });

      await act(async () => {
        const response = await result.current.cancel();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Signup canceled successfully');
        expect(result.current.phase).toBe('canceled');
        expect(result.current.isCanceled).toBe(true);
      });

      expect(mockAuthService.cancelSignup).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    test('should handle cancellation errors', async () => {
      const { result } = renderHook(() => useLocalSignup());

      // First start signup process
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });
      });

      // Mock cancellation error
      const error = new Error('Cancellation failed');
      mockAuthService.cancelSignup.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.cancel();
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to cancel signup: Cancellation failed');
        expect(result.current.phase).toBe('failed');
      });
    });

    test('should handle cancel without email', async () => {
      const { result } = renderHook(() => useLocalSignup());

      await act(async () => {
        const response = await result.current.cancel();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No signup process to cancel');
      });
    });
  });

  describe('Phase Management', () => {
    test('should transition through phases correctly', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Initial state
      expect(result.current.phase).toBe('idle');

      // Start email verification
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });
      });

      expect(result.current.phase).toBe('email_sent');

      // Process token
      mockLocation.search = '?token=verification-token';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(result.current.phase).toBe('email_verified');

      // Complete profile
      mockAuthService.completeProfile.mockResolvedValue({
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Success',
      });

      await act(async () => {
        await result.current.complete({
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123',
          agreeToTerms: true,
        });
      });

      expect(result.current.phase).toBe('completed');
    });

    test('should calculate progress correctly', () => {
      const { result } = renderHook(() => useLocalSignup());

      // Test different phases
      expect(result.current.progress).toBe(0); // idle

      // Progress calculation is tested implicitly through phase transitions
      expect(result.current.currentStep).toBe('Ready to start signup');
      expect(result.current.nextStep).toBe('Enter email to begin');
    });

    test('should determine available actions', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Initial state
      expect(result.current.canComplete).toBe(false);
      expect(result.current.canCancel).toBe(false);
      expect(result.current.canRetry).toBe(false);

      // After starting signup
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: 'http://localhost:3000/verify',
        });
      });

      expect(result.current.canCancel).toBe(true);

      // After email verification
      mockLocation.search = '?token=verification-token';
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: 'profile-token',
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(result.current.canComplete).toBe(true);
    });
  });
});
