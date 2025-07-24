import { useState, useCallback, useRef } from 'react';
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
type TwoFactorPhase = 'idle' | 'setting_up' | 'verifying_setup' | 'generating_codes' | 'completed' | 'failed';

interface TwoFactorState {
  phase: TwoFactorPhase;
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastAttemptTimestamp: number | null;
  // Setup data
  setupData: TwoFactorSetupResponse | null;
  // Status data
  statusData: TwoFactorStatusResponse | null;
  // Backup codes
  backupCodes: string[] | null;
  // Setup token for verification
  setupToken: string | null;
}

interface TwoFactorReturn {
  // Account identification
  accountId: string | null;
  accountType: AccountType | null;

  // Two-factor state
  phase: TwoFactorPhase;
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  retryCount: number;

  // Convenience getters
  isIdle: boolean;
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
  setupToken: string | null;

  // Operations
  setup: (data: TwoFactorSetupRequest) => Promise<TwoFactorSetupResponse | null>;
  verifySetup: (token: string) => Promise<TwoFactorVerifySetupResponse | null>;
  generateBackupCodes: (data: BackupCodesRequest) => Promise<BackupCodesResponse | null>;
  disable: (password?: string) => Promise<{ success: boolean; message?: string }>;
  retry: () => Promise<{ success: boolean; message?: string }>;

  // Utilities
  clearError: () => void;
  reset: () => void;
  canSetup: boolean;
  canDisable: boolean;
  canVerifySetup: boolean;
}

const INITIAL_STATE: TwoFactorState = {
  phase: 'idle',
  loading: false,
  error: null,
  retryCount: 0,
  lastAttemptTimestamp: null,
  setupData: null,
  statusData: null,
  backupCodes: null,
  setupToken: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 5000; // 5 seconds

export function useTwoFactorAuth(accountId: string | null): TwoFactorReturn {
  const authService = useAuthService();
  const [state, setState] = useState<TwoFactorState>(INITIAL_STATE);

  // Refs for retry logic
  const lastSetupDataRef = useRef<TwoFactorSetupRequest | null>(null);
  const lastVerifyTokenRef = useRef<string | null>(null);
  const lastBackupCodesDataRef = useRef<BackupCodesRequest | null>(null);
  const lastDisablePasswordRef = useRef<string | undefined>(undefined);
  const lastOperationRef = useRef<'setup' | 'verify' | 'backup_codes' | 'disable' | null>(null);

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
        lastAttemptTimestamp: Date.now(),
      }));

      return apiError.message;
    },
    [safeSetState],
  );

  const setup = useCallback(
    async (data: TwoFactorSetupRequest, isRetry = false): Promise<TwoFactorSetupResponse | null> => {
      if (!accountId || !accountType) return null;

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'setting_up',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastSetupDataRef.current = data;
          lastOperationRef.current = 'setup';
        }

        const result = await authService.setupTwoFactor(accountId, accountType, data);

        safeSetState((prev) => ({
          ...prev,
          phase: 'verifying_setup',
          loading: false,
          setupData: result,
          setupToken: result.setupToken || null,
          retryCount: 0,
        }));

        return result;
      } catch (error) {
        handleError(error, 'Failed to setup 2FA');
        return null;
      }
    },
    [accountId, accountType, authService, handleError, safeSetState],
  );

  const verifySetup = useCallback(
    async (token: string, isRetry = false): Promise<TwoFactorVerifySetupResponse | null> => {
      if (!accountId || !state.setupToken) {
        const errorMsg = !accountId ? 'No account ID available' : 'No setup token available. Please run setup first.';
        safeSetState((prev) => ({
          ...prev,
          phase: 'failed',
          loading: false,
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
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastVerifyTokenRef.current = token;
          lastOperationRef.current = 'verify';
        }

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
          setupToken: null,
          retryCount: 0,
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
    async (data: BackupCodesRequest, isRetry = false): Promise<BackupCodesResponse | null> => {
      if (!accountId) return null;

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'generating_codes',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastBackupCodesDataRef.current = data;
          lastOperationRef.current = 'backup_codes';
        }

        const result = await authService.generateBackupCodes(accountId, data);

        safeSetState((prev) => ({
          ...prev,
          phase: 'completed',
          loading: false,
          backupCodes: result.backupCodes,
          statusData:
            prev.statusData !== null
              ? {
                  ...prev.statusData,
                  backupCodesCount: result.backupCodes.length,
                }
              : {
                  enabled: true,
                  lastSetupDate: new Date(Date.now()).toString(),
                  backupCodesCount: result.backupCodes.length,
                },
          retryCount: 0,
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
    async (password?: string, isRetry = false): Promise<{ success: boolean; message?: string }> => {
      if (!accountId || !accountType) {
        return { success: false, message: 'No account available' };
      }

      try {
        safeSetState((prev) => ({
          ...prev,
          phase: 'setting_up',
          loading: true,
          error: null,
          retryCount: isRetry ? prev.retryCount : 0,
        }));

        // Store for retry
        if (!isRetry) {
          lastDisablePasswordRef.current = password;
          lastOperationRef.current = 'disable';
        }

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
          setupToken: null,
          retryCount: 0,
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

  // Enhanced retry with cooldown and attempt limits
  const retry = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
      const message = `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`;
      safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
      return { success: false, message };
    }

    if (state.lastAttemptTimestamp && Date.now() - state.lastAttemptTimestamp < RETRY_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - state.lastAttemptTimestamp)) / 1000);
      const message = `Please wait ${remainingTime} seconds before retrying`;
      return { success: false, message };
    }

    safeSetState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }));

    // Retry the specific operation that failed
    switch (lastOperationRef.current) {
      case 'setup':
        if (lastSetupDataRef.current) {
          const result = await setup(lastSetupDataRef.current, true);
          return {
            success: !!result,
            message: result ? '2FA setup retry successful' : '2FA setup retry failed',
          };
        }
        break;
      case 'verify':
        if (lastVerifyTokenRef.current) {
          const result = await verifySetup(lastVerifyTokenRef.current, true);
          return {
            success: !!result,
            message: result ? '2FA verification retry successful' : '2FA verification retry failed',
          };
        }
        break;
      case 'backup_codes':
        if (lastBackupCodesDataRef.current) {
          const result = await generateBackupCodes(lastBackupCodesDataRef.current, true);
          return {
            success: !!result,
            message: result ? 'Backup codes generation retry successful' : 'Backup codes generation retry failed',
          };
        }
        break;
      case 'disable':
        return disable(lastDisablePasswordRef.current, true);
      default:
        break;
    }

    const message = 'No previous operation to retry';
    safeSetState((prev) => ({ ...prev, phase: 'failed', loading: false, error: message }));
    return { success: false, message };
  }, [state.retryCount, state.lastAttemptTimestamp, setup, verifySetup, generateBackupCodes, disable, safeSetState]);

  // Utility functions
  const clearError = useCallback(() => {
    safeSetState((prev) => ({ ...prev, error: null }));
  }, [safeSetState]);

  const reset = useCallback(() => {
    lastSetupDataRef.current = null;
    lastVerifyTokenRef.current = null;
    lastBackupCodesDataRef.current = null;
    lastDisablePasswordRef.current = undefined;
    lastOperationRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Computed values for better UX
  const canRetry =
    state.phase === 'failed' &&
    state.retryCount < MAX_RETRY_ATTEMPTS &&
    state.lastAttemptTimestamp !== null &&
    Date.now() - state.lastAttemptTimestamp >= RETRY_COOLDOWN_MS &&
    lastOperationRef.current !== null;

  // Derived state
  const isEnabled = state.statusData?.enabled ?? false;
  const hasBackupCodes = (state.statusData?.backupCodesCount ?? 0) > 0;
  const backupCodesCount = state.statusData?.backupCodesCount ?? 0;
  const lastSetupDate = state.statusData?.lastSetupDate ?? null;

  const canSetup = !!accountId && !!accountType && !isEnabled;
  const canDisable = !!accountId && !!accountType && isEnabled;
  const canVerifySetup = !!accountId && !!state.setupToken;

  return {
    // Account identification
    accountId: accountId,
    accountType: accountType ?? null,

    // Two-factor state
    phase: state.phase,
    loading: state.loading,
    error: state.error,
    canRetry,
    retryCount: state.retryCount,

    // Convenience getters
    isIdle: state.phase === 'idle',
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
    setupToken: state.setupToken,

    setup,
    verifySetup,
    generateBackupCodes,
    disable,
    retry,

    // Utilities
    clearError,
    reset,
    canSetup,
    canDisable,
    canVerifySetup,
  };
}
