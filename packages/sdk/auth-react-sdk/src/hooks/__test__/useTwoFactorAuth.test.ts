import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTwoFactorAuth } from '../useTwoFactorAuth';
import { useAppStore } from '../../store/useAppStore';
import { AccountType, UnifiedTwoFactorSetupResponse, TwoFactorStatusResponse } from '../../types';

// Mock AuthService
const mockAuthService = {
  getTwoFactorStatus: vi.fn(),
  setupTwoFactor: vi.fn(),
  verifyTwoFactorSetup: vi.fn(),
  generateBackupCodes: vi.fn(),
};

// Mock useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock useAppStore
const mockUpdateAccountData = vi.fn();
const mockGetAccountState = vi.fn();

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('useTwoFactorAuth', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const localAccountType = AccountType.Local;
  const oauthAccountType = AccountType.OAuth;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default store mock
    mockUseAppStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          getAccountState: mockGetAccountState,
          updateAccountData: mockUpdateAccountData,
        } as any);
      }
      return { updateAccountData: mockUpdateAccountData };
    });

    // Default account state
    mockGetAccountState.mockReturnValue({
      data: {
        id: accountId,
        accountType: localAccountType,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('should initialize with idle phase', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      expect(result.current.phase).toBe('idle');
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isCheckingStatus).toBe(false);
      expect(result.current.isSettingUp).toBe(false);
      expect(result.current.isVerifyingSetup).toBe(false);
      expect(result.current.isGeneratingCodes).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.accountId).toBe(accountId);
      expect(result.current.accountType).toBe(localAccountType);
    });

    test('should initialize status properties correctly', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.hasBackupCodes).toBe(false);
      expect(result.current.backupCodesCount).toBe(0);
      expect(result.current.lastSetupDate).toBeNull();
      expect(result.current.setupData).toBeNull();
      expect(result.current.qrCode).toBeNull();
      expect(result.current.secret).toBeNull();
      expect(result.current.backupCodes).toBeNull();
      expect(result.current.setupToken).toBeNull();
    });

    test('should determine capabilities correctly', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      expect(result.current.canSetup).toBe(true); // Has account ID, account type, not enabled
      expect(result.current.canDisable).toBe(false); // Not enabled
      expect(result.current.canVerifySetup).toBe(false); // No setup token
    });

    test('should handle null account ID', () => {
      const { result } = renderHook(() => useTwoFactorAuth(null));

      expect(result.current.accountId).toBeNull();
      expect(result.current.accountType).toBeNull();
      expect(result.current.canSetup).toBe(false);
      expect(result.current.canDisable).toBe(false);
      expect(result.current.canVerifySetup).toBe(false);
    });

    test('should auto-load status when enabled', async () => {
      mockAuthService.getTwoFactorStatus.mockResolvedValue({
        enabled: false,
        backupCodesCount: 0,
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.getTwoFactorStatus).toHaveBeenCalledWith(accountId);
      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('Status Check Flow', () => {
    test('should handle successful status check', async () => {
      const mockStatus: TwoFactorStatusResponse = {
        enabled: true,
        backupCodesCount: 10,
        lastSetupDate: '2022-01-01T00:00:00.000Z',
      };

      mockAuthService.getTwoFactorStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const status = await result.current.checkStatus();
        expect(status).toEqual(mockStatus);
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.hasBackupCodes).toBe(true);
      expect(result.current.backupCodesCount).toBe(10);
      expect(result.current.lastSetupDate).toBe('2022-01-01T00:00:00.000Z');
      expect(result.current.loading).toBe(false);
    });

    test('should handle status check errors', async () => {
      const error = new Error('Failed to get status');
      mockAuthService.getTwoFactorStatus.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const status = await result.current.checkStatus();
        expect(status).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to check 2FA status: Failed to get status');
      expect(result.current.loading).toBe(false);
    });

    test('should update phase during status check', async () => {
      let phaseBeforeCheck: string = '';
      let phaseAfterCheck: string = '';

      mockAuthService.getTwoFactorStatus.mockImplementation(async () => {
        phaseBeforeCheck = result.current.phase;
        return { enabled: false };
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        await result.current.checkStatus();
        phaseAfterCheck = result.current.phase;
      });

      expect(phaseBeforeCheck).toBe('checking_status');
      expect(phaseAfterCheck).toBe('idle');
    });
  });

  describe('2FA Setup Flow', () => {
    test('should handle successful setup for local account', async () => {
      const mockSetupResponse: UnifiedTwoFactorSetupResponse = {
        message: '2FA setup initiated',
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        qrCodeUrl: 'otpauth://totp/Example:user@example.com',
        backupCodes: ['12345678', '87654321'],
        setupToken: 'setup-token-123',
      };

      mockAuthService.setupTwoFactor.mockResolvedValue(mockSetupResponse);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });

        expect(response).toEqual(mockSetupResponse);
      });

      expect(result.current.phase).toBe('verifying_setup');
      expect(result.current.setupData).toEqual(mockSetupResponse);
      expect(result.current.qrCode).toBe(mockSetupResponse.qrCode);
      expect(result.current.secret).toBe(mockSetupResponse.secret);
      expect(result.current.setupToken).toBe(mockSetupResponse.setupToken);
      expect(result.current.canVerifySetup).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    test('should handle successful setup for OAuth account', async () => {
      // Update account type to OAuth
      mockGetAccountState.mockReturnValue({
        data: {
          id: accountId,
          accountType: oauthAccountType,
        },
      });

      const mockSetupResponse: UnifiedTwoFactorSetupResponse = {
        message: '2FA setup initiated',
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        setupToken: 'setup-token-123',
      };

      mockAuthService.setupTwoFactor.mockResolvedValue(mockSetupResponse);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.setup({
          enableTwoFactor: true,
          // No password needed for OAuth accounts
        });

        expect(response).toEqual(mockSetupResponse);
      });

      expect(mockAuthService.setupTwoFactor).toHaveBeenCalledWith(accountId, oauthAccountType, {
        enableTwoFactor: true,
      });
      expect(result.current.phase).toBe('verifying_setup');
    });

    test('should handle setup errors', async () => {
      const error = new Error('Setup failed');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });

        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
      expect(result.current.error).toBe('Failed to setup 2FA: Setup failed');
    });

    test('should update phase during setup', async () => {
      let phaseBeforeSetup: string = '';
      let phaseAfterSetup: string = '';

      mockAuthService.setupTwoFactor.mockImplementation(async () => {
        phaseBeforeSetup = result.current.phase;
        return {
          message: 'Setup initiated',
          setupToken: 'setup-token',
        };
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
        phaseAfterSetup = result.current.phase;
      });

      expect(phaseBeforeSetup).toBe('setting_up');
      expect(phaseAfterSetup).toBe('verifying_setup');
    });
  });

  describe('2FA Setup Verification Flow', () => {
    beforeEach(async () => {
      // Set up hook in verifying_setup state
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: 'Setup initiated',
        setupToken: 'setup-token-123',
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
      });
    });

    test('should handle successful setup verification', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // First setup 2FA
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      // Mock successful verification
      mockAuthService.verifyTwoFactorSetup.mockResolvedValue({
        message: '2FA enabled successfully',
      });

      await act(async () => {
        const response = await result.current.verifySetup('123456');
        expect(response).toEqual({ message: '2FA enabled successfully' });
      });

      expect(result.current.phase).toBe('completed');
      expect(result.current.isCompleted).toBe(true);
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.setupToken).toBeNull(); // Cleared after verification
      expect(result.current.loading).toBe(false);
      expect(mockUpdateAccountData).toHaveBeenCalledWith(accountId, {
        security: { twoFactorEnabled: true },
      });
    });

    test('should handle verification errors', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // First setup 2FA
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      // Mock failed verification
      const error = new Error('Invalid verification code');
      mockAuthService.verifyTwoFactorSetup.mockRejectedValue(error);

      await act(async () => {
        const response = await result.current.verifySetup('wrongcode');
        expect(response).toBeNull();
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.isFailed).toBe(true);
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

    test('should update phase during verification', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // First setup 2FA
      await act(async () => {
        await result.current.setup({
          enableTwoFactor: true,
          password: 'userpassword123',
        });
      });

      let phaseBeforeVerify: string = '';
      let phaseAfterVerify: string = '';

      mockAuthService.verifyTwoFactorSetup.mockImplementation(async () => {
        phaseBeforeVerify = result.current.phase;
        return { message: 'Verified' };
      });

      await act(async () => {
        await result.current.verifySetup('123456');
        phaseAfterVerify = result.current.phase;
      });

      expect(phaseBeforeVerify).toBe('verifying_setup');
      expect(phaseAfterVerify).toBe('completed');
    });
  });

  describe('Backup Codes Generation Flow', () => {
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
      expect(result.current.loading).toBe(false);
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

    test('should update phase during backup codes generation', async () => {
      let phaseBeforeGenerate: string = '';
      let phaseAfterGenerate: string = '';

      mockAuthService.generateBackupCodes.mockImplementation(async () => {
        phaseBeforeGenerate = result.current.phase;
        return {
          message: 'Generated',
          backupCodes: ['12345678'],
        };
      });

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        await result.current.generateBackupCodes({ password: 'userpassword123' });
        phaseAfterGenerate = result.current.phase;
      });

      expect(phaseBeforeGenerate).toBe('generating_codes');
      expect(phaseAfterGenerate).toBe('completed');
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
      expect(result.current.backupCodes).toBeNull();
      expect(result.current.setupToken).toBeNull();
      expect(mockUpdateAccountData).toHaveBeenCalledWith(accountId, {
        security: { twoFactorEnabled: false },
      });
    });

    test('should handle 2FA disable errors', async () => {
      const error = new Error('Failed to disable 2FA');
      mockAuthService.setupTwoFactor.mockRejectedValue(error);

      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      await act(async () => {
        const response = await result.current.disable('userpassword123');
        expect(response.success).toBe(false);
        expect(response.message).toBe('Failed to disable 2FA: Failed to disable 2FA');
      });

      expect(result.current.phase).toBe('failed');
      expect(result.current.error).toBe('Failed to disable 2FA: Failed to disable 2FA');
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

  describe('Validation and Error Handling', () => {
    test('should handle operations without account ID', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(null));

      // All operations should return null gracefully
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

      // No API calls should be made
      expect(mockAuthService.getTwoFactorStatus).not.toHaveBeenCalled();
      expect(mockAuthService.setupTwoFactor).not.toHaveBeenCalled();
      expect(mockAuthService.verifyTwoFactorSetup).not.toHaveBeenCalled();
      expect(mockAuthService.generateBackupCodes).not.toHaveBeenCalled();
    });

    test('should handle operations without account type', async () => {
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
  });

  describe('Utility Functions', () => {
    test('should clear errors', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // Set an error first
      const error = new Error('Test error');
      mockAuthService.getTwoFactorStatus.mockRejectedValue(error);

      await act(async () => {
        await result.current.checkStatus();
      });

      expect(result.current.error).toBeTruthy();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should reset state', () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // Reset to initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.setupData).toBeNull();
      expect(result.current.backupCodes).toBeNull();
      expect(result.current.setupToken).toBeNull();
    });

    test('should update capabilities based on state', async () => {
      const { result } = renderHook(() => useTwoFactorAuth(accountId, { autoLoadStatus: false }));

      // Initially can setup, cannot disable
      expect(result.current.canSetup).toBe(true);
      expect(result.current.canDisable).toBe(false);

      // After loading enabled status
      mockAuthService.getTwoFactorStatus.mockResolvedValue({
        enabled: true,
        backupCodesCount: 5,
      });

      await act(async () => {
        await result.current.checkStatus();
      });

      expect(result.current.canSetup).toBe(false); // Already enabled
      expect(result.current.canDisable).toBe(true); // Now enabled

      // After setup with token
      mockAuthService.setupTwoFactor.mockResolvedValue({
        message: 'Setup',
        setupToken: 'token',
      });

      await act(async () => {
        await result.current.setup({ enableTwoFactor: true });
      });

      expect(result.current.canVerifySetup).toBe(true); // Has setup token
    });
  });
});
