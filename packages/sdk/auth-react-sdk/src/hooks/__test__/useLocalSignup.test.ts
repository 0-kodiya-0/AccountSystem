import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalSignup } from '../useLocalSignup';
import { createMockAuthService, setupBrowserMocks, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useLocalSignup', () => {
  let mockLocation: ReturnType<typeof setupBrowserMocks>['mockLocation'];
  let mockHistory: ReturnType<typeof setupBrowserMocks>['mockHistory'];

  beforeEach(() => {
    const browserMocks = setupBrowserMocks();
    mockLocation = browserMocks.mockLocation;
    mockHistory = browserMocks.mockHistory;
  });

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should auto-process token when enabled', async () => {
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified successfully',
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
        email: 'test@example.com',
      });

      let result: any;
      await act(async () => {
        const hook = renderHook(() => useLocalSignup({ autoProcessToken: true }));
        result = hook.result;
      });

      expect(mockAuthService.verifyEmailForSignup).toHaveBeenCalledWith(TEST_CONSTANTS.TOKENS.VERIFICATION);
      expect(result.current.phase).toBe('email_verified');
    });
  });

  describe('Email Verification Request', () => {
    test('should handle successful email verification request', async () => {
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Verification email sent successfully',
        email: 'test@example.com',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });

        expect(response.success).toBe(true);
        expect(response.message).toBe('Verification email sent successfully');
      });

      expect(result.current.phase).toBe('email_sent');
    });

    test('should handle email send errors', async () => {
      const error = new Error('Email service unavailable');
      mockAuthService.requestEmailVerification.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.start({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });

        expect(response.success).toBe(false);
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to send verification email: Email service unavailable');
    });
  });

  describe('Token Processing', () => {
    test('should process token from URL successfully', async () => {
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}&other=param`;
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified',
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Email verification successful');
      });

      expect(mockAuthService.verifyEmailForSignup).toHaveBeenCalledWith(TEST_CONSTANTS.TOKENS.VERIFICATION);
      expect(result.current.phase).toBe('email_verified');
    });

    test('should handle invalid tokens', async () => {
      mockLocation.search = '?token=invalid-token';
      const error = new Error('Invalid verification token');
      mockAuthService.verifyEmailForSignup.mockRejectedValue(error);

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid token found');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Email verification failed: Invalid verification token');
    });

    test('should clean URL after processing token', async () => {
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;
      mockLocation.href = `${TEST_CONSTANTS.URLs.BASE}?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;

      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        message: 'Email verified',
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
        email: 'test@example.com',
      });

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', TEST_CONSTANTS.URLs.BASE);
    });

    test('should handle missing token gracefully', async () => {
      mockLocation.search = '';

      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.processTokenFromUrl();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No valid token found');
      });

      expect(mockAuthService.verifyEmailForSignup).not.toHaveBeenCalled();
    });
  });

  describe('Profile Completion', () => {
    test('should complete profile successfully', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Set up email verified state
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      // Complete profile
      mockAuthService.completeProfile.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
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
        expect(response.accountId).toBe(TEST_CONSTANTS.ACCOUNT_IDS.CURRENT);
        expect(response.message).toBe('Welcome John Doe! Your account has been created successfully.');
      });

      expect(result.current.phase).toBe('completed');
    });

    test('should handle profile completion errors', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Set up email verified state
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
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
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('Cancellation', () => {
    test('should cancel signup process successfully', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Start signup process
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });
      });

      // Cancel
      mockAuthService.cancelSignup.mockResolvedValue({
        message: 'Signup canceled successfully',
      });

      await act(async () => {
        const response = await result.current.cancel();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Signup canceled successfully');
      });

      expect(result.current.phase).toBe('canceled');

      expect(mockAuthService.cancelSignup).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    test('should handle cancel without active signup', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      await act(async () => {
        const response = await result.current.cancel();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No signup process to cancel');
      });
    });
  });

  describe('Complete Signup Flow', () => {
    test('should transition through all phases correctly', async () => {
      const { result } = renderHook(() => useLocalSignup({ autoProcessToken: false }));

      // Start email verification
      mockAuthService.requestEmailVerification.mockResolvedValue({
        message: 'Email sent',
        email: 'test@example.com',
        callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
      });

      await act(async () => {
        await result.current.start({
          email: 'test@example.com',
          callbackUrl: TEST_CONSTANTS.URLs.CALLBACK,
        });
      });

      expect(result.current.phase).toBe('email_sent');

      // Process token
      mockLocation.search = `?token=${TEST_CONSTANTS.TOKENS.VERIFICATION}`;
      mockAuthService.verifyEmailForSignup.mockResolvedValue({
        profileToken: TEST_CONSTANTS.TOKENS.PROFILE,
        email: 'test@example.com',
        message: 'Verified',
      });

      await act(async () => {
        await result.current.processTokenFromUrl();
      });

      expect(result.current.phase).toBe('email_verified');

      // Complete profile
      mockAuthService.completeProfile.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
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
  });
});
