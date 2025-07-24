import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalSignin } from '../useLocalSignin';
import { LocalLoginResponse } from '../../types';
import { createMockAuthService, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useLocalSignin', () => {
  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useLocalSignin());

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.requiresTwoFactor).toBe(false);
      expect(result.current.tempToken).toBeNull();
      expect(result.current.accountId).toBeNull();
    });
  });

  describe('Signin Flow', () => {
    test('should handle successful signin without 2FA', async () => {
      const mockResponse: LocalLoginResponse = {
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
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
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.accountId).toBe(TEST_CONSTANTS.ACCOUNT_IDS.CURRENT);
      expect(result.current.accountName).toBe('John Doe');
    });

    test('should handle signin requiring 2FA', async () => {
      const mockResponse: LocalLoginResponse = {
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
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
      });

      expect(result.current.phase).toBe('requires_2fa');
      expect(result.current.requiresTwoFactor).toBe(true);
      expect(result.current.tempToken).toBe(TEST_CONSTANTS.TOKENS.TEMP);
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
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Signin failed: Invalid credentials');
    });
  });

  describe('2FA Verification Flow', () => {
    test('should handle successful 2FA verification', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // First sign in to get to 2FA state
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Mock successful 2FA verification
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: 'Two-factor authentication successful!',
      });

      await act(async () => {
        const response = await result.current.verify2FA('123456');

        expect(response.success).toBe(true);
        expect(response.message).toBe('Two-factor authentication successful!');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.tempToken).toBeNull();
    });

    test('should validate 2FA inputs properly', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Try to verify without temp token
      await act(async () => {
        const response = await result.current.verify2FA('123456');
        expect(response.success).toBe(false);
        expect(response.message).toBe('No temporary token available. Please sign in again.');
      });

      // Set up 2FA state
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Try with empty token
      await act(async () => {
        const response = await result.current.verify2FA('');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Verification code is required');
      });
    });

    test('should handle 2FA verification errors', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Set up 2FA state
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      const error = new Error('Invalid verification code');
      mockAuthService.verifyTwoFactorLogin.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verify2FA('wrongcode');

        expect(response.success).toBe(false);
        expect(response.message).toBe('Two-factor verification failed: Invalid verification code');
      });

      expect(result.current.phase).toBe('failed');
    });
  });

  describe('Retry Logic', () => {
    test('should handle retry with cooldown mechanism for signin', async () => {
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

      // Immediately try to retry - should be blocked by cooldown
      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toContain('Please wait');
      });

      // Advance time past cooldown (5 seconds)
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.localLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: 'Signin successful!',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
      });

      expect(result.current.retryCount).toBe(0); // Reset to 0 on successful retry
      expect(result.current.phase).toBe('completed');
    });

    test('should handle retry for 2FA verification', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Set up 2FA state
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // 2FA verification fails
      const error = new Error('Invalid code');
      mockAuthService.verifyTwoFactorLogin.mockRejectedValue(error);

      await act(async () => {
        await result.current.verify2FA('123456');
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: 'Success!',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
      });

      expect(result.current.phase).toBe('completed');
    });

    test('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useLocalSignin());

      const error = new Error('Network error');
      mockAuthService.localLogin.mockRejectedValue(error);

      // Initial attempt fails
      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(result.current.phase).toBe('failed');

      // Perform exactly MAX_RETRY_ATTEMPTS (3) retries that all fail
      for (let i = 1; i <= 3; i++) {
        // Advance time past cooldown
        act(() => {
          vi.advanceTimersByTime(6000);
        });

        await act(async () => {
          const response = await result.current.retry();
          expect(response.success).toBe(false);
          expect(response.message).toBe('Signin failed: Network error');
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
      const { result } = renderHook(() => useLocalSignin());

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous signin attempt to retry');
      });
    });
  });

  describe('Progress Management', () => {
    test('should provide correct progress values for different phases', async () => {
      const { result } = renderHook(() => useLocalSignin());

      // Initial state
      expect(result.current.progress).toBe(0);

      // After 2FA required
      mockAuthService.localLogin.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: TEST_CONSTANTS.TOKENS.TEMP,
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
      });

      await act(async () => {
        await result.current.signin({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(result.current.progress).toBe(60);

      // After completion
      mockAuthService.verifyTwoFactorLogin.mockResolvedValue({
        accountId: TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        name: 'John Doe',
        message: 'Success!',
      });

      await act(async () => {
        await result.current.verify2FA('123456');
      });

      expect(result.current.progress).toBe(100);
    });
  });
});
