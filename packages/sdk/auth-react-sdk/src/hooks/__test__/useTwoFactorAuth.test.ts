import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTwoFactorAuth } from '../useTwoFactorAuth';
import { AccountType } from '../../types';
import { createMockAuthService, createMockStoreSelectors, TEST_CONSTANTS } from '../../test/utils';

// Mock AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock useAppStore
const { mockGetAccountState, mockUpdateAccountData } = createMockStoreSelectors();

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
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.accountId).toBe(accountId);
      expect(result.current.accountType).toBe(AccountType.Local);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.hasBackupCodes).toBe(false);
      expect(result.current.setupData).toBeNull();
      expect(result.current.canSetup).toBe(true);
      expect(result.current.canDisable).toBe(false);
    });

    test('should handle null account ID', () => {
      const { result } = renderHook(() => useTwoFactorAuth(null, { autoLoadStatus: false }));

      expect(result.current.accountId).toBeNull();
      expect(result.current.accountType).toBeNull();
      expect(result.current.canSetup).toBe(false);
      expect(result.current.canDisable).toBe(false);
    });

    test('should auto-load status when enabled', async () => {
      mockAuthService.getTwoFactorStatus.mockResolvedValue({
        enabled: false,
        backupCodesCount: 0,
      });

      let result: any;
      await act(async () => {
        const hook = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: true }));
        result = hook.result;
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.setupToken).toBeNull(); // Cleared after verification
      expect(mockUpdateAccountData).toHaveBeenCalledWith(accountId, {
        security: { twoFactorEnabled: true },
      });
    });

    test('should handle verification errors', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // First setup 2FA
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

      const error = new Error('Invalid verification code');
      mockAuthService.verifyTwoFactorSetup.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verifySetup('wrongcode');
        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to verify 2FA setup: Invalid verification code');
    });

    test('should validate verification without setup token', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.verifySetup('123456');
        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('No setup token available. Please run setup first.');
    });
  });

  describe('Backup Codes Generation', () => {
    test('should handle successful backup codes generation', async () => {
      const mockBackupCodes = ['12345678', '87654321', '11111111', '22222222', '33333333'];
      mockAuthService.generateBackupCodes.mockResolvedValue({
        message: 'Backup codes generated',
        backupCodes: mockBackupCodes,
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

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

    test('should handle backup codes generation errors', async () => {
      const error = new Error('Failed to generate codes');
      mockAuthService.generateBackupCodes.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

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
    test('should handle successful 2FA disable', async () => {
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: '2FA disabled successfully',
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

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

    test('should handle disable errors', async () => {
      const error = new Error('Failed to disable 2FA');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.disable('userpassword123');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to disable 2FA: Failed to disable 2FA');
      });

      expect(result.current.phase).toBe('failed');
    });

    test('should handle disable without account', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(null, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.disable('password');
        expect(response.success).toBe(false);
        expect(response.message).toBe('No account available');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle operations without account ID gracefully', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(null, { autoLoadStatus: false }));

      await act(async () => {
        const statusResult = await result.current.checkStatus();
        expect(statusResult).toBeNull();

        const setupResult = await result.current.setup({ enableTwoFactor: true });
        expect(setupResult).toBeNull();

        const verifyResult = await result.current.verifySetup('123456');
        expect(verifyResult).toBeNull();

        const backupResult = await result.current.generateBackupCodes({});
        expect(backupResult).toBeNull();
      });

      expect(mockAuthService.getTwoFactorStatus).not.toHaveBeenCalled();
      expect(mockAuthService.setupTwoFactor).not.toHaveBeenCalled();
      expect(mockAuthService.verifyTwoFactorSetup).not.toHaveBeenCalled();
      expect(mockAuthService.generateBackupCodes).not.toHaveBeenCalled();
    });

    test('should handle missing account type', async () => {
      mockGetAccountState.mockReturnValue({
        data: {
          id: accountId,
          accountType: null,
        },
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      expect(result.current.canSetup).toBe(false);
      expect(result.current.canDisable).toBe(false);

      await act(async () => {
        const setupResult = await result.current.setup({ enableTwoFactor: true });
        expect(setupResult).toBeNull();

        const disableResult = await result.current.disable();
        expect(disableResult.success).toBe(false);
      });
    });
  });
});
