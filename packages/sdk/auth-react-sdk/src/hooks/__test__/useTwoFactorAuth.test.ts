import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTwoFactorAuth } from '../useTwoFactorAuth';
import { AccountType } from '../../types';
import { createMockAuthService, createMockStoreSelectors, TEST_CONSTANTS } from '../../test/utils';

const mockAuthService = createMockAuthService();
const { mockGetAccountState, mockUpdateAccountData } = createMockStoreSelectors();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    return selector({
      getAccountState: mockGetAccountState,
      updateAccountData: mockUpdateAccountData,
    });
  }),
}));

describe('useTwoFactorAuth', () => {
  const accountId = TEST_CONSTANTS.ACCOUNT_IDS.CURRENT;

  beforeEach(() => {
    // Default account state
    mockGetAccountState.mockReturnValue({
      data: {
        id: accountId,
        accountType: AccountType.Local,
      },
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      let result: any;
      act(() => {
        result = renderHook(() => useTwoFactorAuth(accountId)).result;
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.accountId).toBe(accountId);
      expect(result.current.accountType).toBe(AccountType.Local);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.hasBackupCodes).toBe(false);
      expect(result.current.setupData).toBeNull();
      expect(result.current.canSetup).toBe(true);
      expect(result.current.canDisable).toBe(false);
    });

    it('should handle null account ID', () => {
      const { result } = renderHook(() => useTwoFactorAuth(null));

      expect(result.current.accountId).toBeNull();
      expect(result.current.accountType).toBeNull();
      expect(result.current.canSetup).toBe(false);
      expect(result.current.canDisable).toBe(false);
    });
  });

  describe('2FA Setup Flow', () => {
    it('should handle successful 2FA setup', async () => {
      const mockSetupData = {
        message: 'Setup initiated',
        setupToken: TEST_CONSTANTS.TOKENS.SETUP,
        qrCode: 'data:image/png;base64,mockqrcode',
        secret: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['12345678', '87654321'],
      };

      mockAuthService.setupTwoFactor.mockResolvedValue(mockSetupData);

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });

        expect(response).toEqual(mockSetupData);
      });

      expect(result.current.phase).toBe('verifying_setup');
      expect(result.current.setupData).toEqual(mockSetupData);
      expect(result.current.setupToken).toBe(TEST_CONSTANTS.TOKENS.SETUP);
      expect(result.current.canVerifySetup).toBe(true);
    });

    it('should handle setup errors', async () => {
      const error = new Error('Setup failed');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });

        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to setup 2FA: Setup failed');
    });
  });

  describe('2FA Verification Flow', () => {
    beforeEach(async () => {
      // Set up 2FA first
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: 'Setup initiated',
        setupToken: TEST_CONSTANTS.TOKENS.SETUP,
        qrCode: 'data:image/png;base64,mockqrcode',
        secret: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['12345678', '87654321'],
      });
    });

    it('should handle successful verification', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // Setup first
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      // Mock successful verification
      mockAuthService.verifyTwoFactorSetup.mockResolvedValue({
        message: 'Verification successful',
      });

      await act(async () => {
        const response = await result.current.verifySetup('123456');
        expect(response).toEqual({ message: 'Verification successful' });
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.setupToken).toBeNull();
      expect(mockUpdateAccountData).toHaveBeenCalledWith(accountId, {
        security: { twoFactorEnabled: true },
      });
    });

    it('should handle verification errors', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // Setup first
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      const error = new Error('Invalid verification code');
      mockAuthService.verifyTwoFactorSetup.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verifySetup('wrongcode');
        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to verify 2FA setup: Invalid verification code');
    });

    it('should validate verification without setup token', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.verifySetup('123456');
        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('No setup token available. Please run setup first.');
    });
  });

  describe('Backup Codes Generation', () => {
    it('should handle successful backup codes generation', async () => {
      const mockBackupCodes = ['12345678', '87654321', '11111111', '22222222', '33333333'];
      mockAuthService.generateBackupCodes.mockResolvedValue({
        message: 'Backup codes generated',
        backupCodes: mockBackupCodes,
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.generateBackupCodes({
          password: 'userpassword123',
        });

        expect(response).toEqual({
          message: 'Backup codes generated',
          backupCodes: mockBackupCodes,
        });
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.backupCodes).toEqual(mockBackupCodes);
      expect(result.current.backupCodesCount).toBe(5);
    });

    it('should handle backup codes generation errors', async () => {
      const error = new Error('Failed to generate codes');
      mockAuthService.generateBackupCodes.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.generateBackupCodes({
          password: 'userpassword123',
        });

        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to generate backup codes: Failed to generate codes');
    });
  });

  describe('2FA Disable Flow', () => {
    it('should handle successful 2FA disable', async () => {
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: '2FA disabled successfully',
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.disable('userpassword123');
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA disabled successfully');
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.backupCodesCount).toBe(0);
      expect(result.current.setupData).toBeNull();

      expect(mockUpdateAccountData).toHaveBeenCalledWith(accountId, {
        security: { twoFactorEnabled: false },
      });
    });

    it('should handle disable errors', async () => {
      const error = new Error('Failed to disable 2FA');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.disable('userpassword123');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to disable 2FA: Failed to disable 2FA');
      });

      expect(result.current.phase).toBe('failed');
    });

    it('should handle disable without account', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(null));

      await act(async () => {
        const response = await result.current.disable('password');
        expect(response.success).toBe(false);
        expect(response.message).toBe('No account available');
      });
    });
  });

  describe('Retry Logic', () => {
    it('should handle retry with cooldown mechanism for setup', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
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
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: 'Setup successful on retry',
        setupToken: TEST_CONSTANTS.TOKENS.SETUP,
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA setup retry successful');
      });

      expect(result.current.retryCount).toBe(0); // Reset to 0 on successful retry
      expect(result.current.phase).toBe('verifying_setup');
    });

    it('should handle retry for verification', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // Setup first
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: 'Setup initiated',
        setupToken: TEST_CONSTANTS.TOKENS.SETUP,
      });

      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      // Verification fails
      const error = new Error('Invalid code');
      mockAuthService.verifyTwoFactorSetup.mockRejectedValue(error);

      await act(async () => {
        await result.current.verifySetup('123456');
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.verifyTwoFactorSetup.mockResolvedValue({
        message: 'Verification successful',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA verification retry successful');
      });

      expect(result.current.phase).toBe('completed');
    });

    it('should handle retry for backup codes generation', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.generateBackupCodes.mockRejectedValue(error);

      await act(async () => {
        await result.current.generateBackupCodes({
          password: 'userpassword123',
        });
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.generateBackupCodes.mockResolvedValue({
        message: 'Backup codes generated',
        backupCodes: ['12345678', '87654321'],
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('Backup codes generation retry successful');
      });

      expect(result.current.phase).toBe('completed');
    });

    it('should handle retry for disable operation', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      // First attempt fails
      const error = new Error('Network error');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      await act(async () => {
        await result.current.disable('userpassword123');
      });

      expect(result.current.phase).toBe('failed');

      // Advance time past cooldown
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Mock successful retry
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: '2FA disabled successfully',
      });

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(true);
        expect(response.message).toBe('2FA disabled successfully');
      });

      expect(result.current.phase).toBe('completed');
    });

    it('should respect maximum retry limits', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      const error = new Error('Persistent error');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      // Initial attempt fails
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
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
          expect(response.message).toBe('2FA setup retry failed');
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

    it('should handle retry without previous operation', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      await act(async () => {
        const response = await result.current.retry();
        expect(response.success).toBe(false);
        expect(response.message).toBe('No previous operation to retry');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle operations without account ID gracefully', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(null));

      await act(async () => {
        const setupResult = await result.current.setup({ enableTwoFactor: true });
        expect(setupResult).toBeNull();

        const verifyResult = await result.current.verifySetup('123456');
        expect(verifyResult).toBeNull();

        const backupResult = await result.current.generateBackupCodes({});
        expect(backupResult).toBeNull();
      });

      expect(mockAuthService.setupTwoFactor).not.toHaveBeenCalled();
      expect(mockAuthService.verifyTwoFactorSetup).not.toHaveBeenCalled();
      expect(mockAuthService.generateBackupCodes).not.toHaveBeenCalled();
    });

    it('should handle missing account type', async () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: accountId,
          accountType: null,
        },
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      expect(result.current.canSetup).toBe(false);
      expect(result.current.canDisable).toBe(false);

      await act(async () => {
        const setupResult = await result.current.setup({ enableTwoFactor: true });
        expect(setupResult).toBeNull();

        const disableResult = await result.current.disable();
        expect(disableResult.success).toBe(false);
      });
    });

    it('should properly reset state and clear retry data', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId));

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.setupData).toBeNull();
      expect(result.current.setupToken).toBeNull();
      expect(result.current.backupCodes).toBeNull();
    });
  });
});
