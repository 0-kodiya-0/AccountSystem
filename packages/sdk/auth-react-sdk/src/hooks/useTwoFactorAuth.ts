import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import {
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifySetupResponse,
  BackupCodesRequest,
  BackupCodesResponse,
  TwoFactorStatusResponse,
  AccountType,
} from '../types';
import { parseApiError } from '../utils';

// Two-factor authentication phases
type TwoFactorPhase =
  | 'idle'
  | 'checking_status'
  | 'setting_up'
  | 'verifying_setup'
  | 'generating_codes'
  | 'completed'
  | 'failed';

interface TwoFactorState {
  phase: TwoFactorPhase;
  loading: boolean;
  error: string | null;
  // Setup data
  setupData: TwoFactorSetupResponse | null;
  // Status data
  statusData: TwoFactorStatusResponse | null;
  // Backup codes
  backupCodes: string[] | null;
  // NEW: Setup token for verification
  setupToken: string | null;
}

interface TwoFactorOptions {
  autoLoadStatus?: boolean; // Whether to automatically load 2FA status on mount (default: true)
}

interface TwoFactorReturn {
  // Account identification
  accountId: string | null;
  accountType: AccountType | null;

  // Two-factor state
  phase: TwoFactorPhase;
  loading: boolean;
  error: string | null;

  // Convenience getters
  isIdle: boolean;
  isCheckingStatus: boolean;
  isSettingUp: boolean;
  isVerifyingSetup: boolean;
  isGeneratingCodes: boolean;
  isCompleted: boolean;
  isFailed: boolean;

  // Status information
  isEnabled: boolean;
  hasBackupCodes: boolean;
  backupCodesCount: number;
  lastSetupDate: string | null;

  // Setup data
  setupData: TwoFactorSetupResponse | null;
  qrCode: string | null;
  secret: string | null;
  backupCodes: string[] | null;
  setupToken: string | null; // NEW: Setup token for verification

  // Operations
  checkStatus: () => Promise<TwoFactorStatusResponse | null>;
  setup: (data: TwoFactorSetupRequest) => Promise<TwoFactorSetupResponse | null>;
  verifySetup: (token: string) => Promise<TwoFactorVerifySetupResponse | null>; // UPDATED
  generateBackupCodes: (data: BackupCodesRequest) => Promise<BackupCodesResponse | null>;
  disable: (password?: string) => Promise<{ success: boolean; message?: string }>;

  // Utilities
  clearError: () => void;
  reset: () => void;
  canSetup: boolean;
  canDisable: boolean;
  canVerifySetup: boolean; // NEW: Can verify setup (has setup token)
}

const INITIAL_STATE: TwoFactorState = {
  phase: 'idle',
  loading: false,
  error: null,
  setupData: null,
  statusData: null,
  backupCodes: null,
  setupToken: null, // NEW
};

export function useTwoFactorAuth(accountId: string | null, options: TwoFactorOptions = {}): TwoFactorReturn {
  const { autoLoadStatus = true } = options;

  const authService = useAuthService();
  const [state, setState] = useState<TwoFactorState>(INITIAL_STATE);

  // Get account data from store to determine account type
  const accountType = useAppStore((state) => {
    if (!accountId) return null;
    const accountState = state.getAccountState(accountId);
    return accountState ? accountState.data?.accountType : null;
  });
  const updateAccountData = useAppStore((state) => state.updateAccountData);

  // Safe state update
  const safeSetState = useCallback((updater: (prev: TwoFactorState) => TwoFactorState) => {
    setState(updater);
  }, []);

  // Enhanced error handling
  const handleError = useCallback(
    (error: any, context: string) => {
      const apiError = parseApiError(error, context);

      safeSetState((prev) => ({
        ...prev,
        phase: 'failed',
        loading: false,
        error: apiError.message,
      }));

      return apiError.message;
    },
    [safeSetState],
  );

  // Two-factor operations
  const checkStatus = useCallback(async () => {
    if (!accountId) return null;

    try {
      safeSetState((prev) => ({
        ...prev,
        phase: 'checking_status',
        loading: true,
        error: null,
      }));

      const result = await authService.getTwoFactorStatus(accountId);

      safeSetState((prev) => ({
        ...prev,
        phase: 'idle',
        loading: false,
        statusData: result,
      }));

      return result;
    } catch (error) {
      handleError(error, 'Failed to check 2FA status');
      return null;
    }
  }, [accountId, authService, handleError, safeSetState]);

  const setup = useCallback(
    async (data: TwoFactorSetupRequest) => {
      if (!accountId || !accountType) return null;

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'setting_up',
          loading: true,
          error: null,
        }));

        const result = await authService.setupTwoFactor(accountId, accountType, data);

        safeSetState((prev) => ({
          ...prev,
          phase: 'verifying_setup',
          loading: false,
          setupData: result,
          setupToken: result.setupToken || null, // NEW: Store setup token
        }));

        return result;
      } catch (error) {
        handleError(error, 'Failed to setup 2FA');
        return null;
      }
    },
    [accountId, accountType, authService, handleError, safeSetState],
  );

  // UPDATED: Now uses setup token from state
  const verifySetup = useCallback(
    async (token: string) => {
      if (!accountId || !state.setupToken) {
        const errorMsg = !accountId ? 'No account ID available' : 'No setup token available. Please run setup first.';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          error: errorMsg,
        }));
        return null;
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'verifying_setup',
          loading: true,
          error: null,
        }));

        const result = await authService.verifyTwoFactorSetup(accountId, token, state.setupToken);

        // Update account security state
        updateAccountData(accountId, {
          security: { twoFactorEnabled: true } as any,
        });

        safeSetState((prev) => ({
          ...prev,
          phase: 'completed',
          loading: false,
          statusData: {
            enabled: true,
            backupCodesCount: prev.setupData?.backupCodes?.length || 0,
            lastSetupDate: new Date().toISOString(),
          },
          backupCodes: prev.setupData?.backupCodes || null,
          setupToken: null, // Clear setup token after successful verification
        }));

        return result;
      } catch (error) {
        handleError(error, 'Failed to verify 2FA setup');
        return null;
      }
    },
    [accountId, state.setupToken, authService, updateAccountData, handleError, safeSetState],
  );

  const generateBackupCodes = useCallback(
    async (data: BackupCodesRequest) => {
      if (!accountId) return null;

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'generating_codes',
          loading: true,
          error: null,
        }));

        const result = await authService.generateBackupCodes(accountId, data);

        safeSetState((prev) => ({
          ...prev,
          phase: 'completed',
          loading: false,
          backupCodes: result.backupCodes,
          statusData: prev.statusData
            ? {
                ...prev.statusData,
                backupCodesCount: result.backupCodes.length,
              }
            : null,
        }));

        return result;
      } catch (error) {
        handleError(error, 'Failed to generate backup codes');
        return null;
      }
    },
    [accountId, authService, handleError, safeSetState],
  );

  const disable = useCallback(
    async (password?: string) => {
      if (!accountId || !accountType) {
        return { success: false, message: 'No account available' };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'setting_up',
          loading: true,
          error: null,
        }));

        // Call setup with enableTwoFactor: false to disable
        const result = await authService.setupTwoFactor(accountId, accountType, {
          enableTwoFactor: false,
          password,
        });

        // Update account security state
        updateAccountData(accountId, {
          security: { twoFactorEnabled: false } as any,
        });

        safeSetState((prev) => ({
          ...prev,
          phase: 'completed',
          loading: false,
          statusData: {
            enabled: false,
            backupCodesCount: 0,
          },
          setupData: null,
          backupCodes: null,
          setupToken: null, // Clear setup token
        }));

        return {
          success: true,
          message: result.message || 'Two-factor authentication disabled successfully',
        };
      } catch (error) {
        const message = handleError(error, 'Failed to disable 2FA');
        return { success: false, message };
      }
    },
    [accountId, accountType, authService, updateAccountData, handleError, safeSetState],
  );

  // Auto-load status on mount
  useEffect(() => {
    if (autoLoadStatus && accountId && state.phase === 'idle' && !state.statusData) {
      checkStatus();
    }
  }, [autoLoadStatus, accountId, state.phase]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // Derived state
  const isEnabled = state.statusData?.enabled ?? false;
  const hasBackupCodes = (state.statusData?.backupCodesCount ?? 0) > 0;
  const backupCodesCount = state.statusData?.backupCodesCount ?? 0;
  const lastSetupDate = state.statusData?.lastSetupDate ?? null;

  const canSetup = !!accountId && !!accountType && !isEnabled;
  const canDisable = !!accountId && !!accountType && isEnabled;
  const canVerifySetup = !!accountId && !!state.setupToken; // NEW: Can verify if setup token exists

  return {
    // Account identification
    accountId: accountId,
    accountType: accountType ?? null,

    // Two-factor state
    phase: state.phase,
    loading: state.loading,
    error: state.error,

    // Convenience getters
    isIdle: state.phase === 'idle',
    isCheckingStatus: state.phase === 'checking_status',
    isSettingUp: state.phase === 'setting_up',
    isVerifyingSetup: state.phase === 'verifying_setup',
    isGeneratingCodes: state.phase === 'generating_codes',
    isCompleted: state.phase === 'completed',
    isFailed: state.phase === 'failed',

    // Status information
    isEnabled,
    hasBackupCodes,
    backupCodesCount,
    lastSetupDate,

    // Setup data
    setupData: state.setupData,
    qrCode: state.setupData?.qrCode ?? null,
    secret: state.setupData?.secret ?? null,
    backupCodes: state.backupCodes,
    setupToken: state.setupToken, // NEW: Expose setup token

    // Operations
    checkStatus,
    setup,
    verifySetup,
    generateBackupCodes,
    disable,

    // Utilities
    clearError,
    reset,
    canSetup,
    canDisable,
    canVerifySetup, // NEW: Can verify setup capability
  };
}
