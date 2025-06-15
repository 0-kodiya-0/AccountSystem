import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { AccountType } from '../types';

// Get ServiceManager instance at module level
const serviceManager = ServiceManager.getInstance();

export enum TwoFactorSetupStatus {
  IDLE = 'idle',
  SETTING_UP = 'setting_up',
  VERIFYING_SETUP = 'verifying_setup',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export interface Use2FASetupOptions {
  accountId?: string;
  onSetupComplete?: (message: string) => void;
  onVerified?: (message: string) => void;
  onError?: (error: string) => void;
}

export const use2FASetup = (options: Use2FASetupOptions = {}) => {
  const { accountId: providedAccountId, onSetupComplete, onVerified, onError } = options;

  // Get current account from store if accountId not provided
  const currentAccountId = useAppStore((state) => state.session.currentAccountId);
  const accounts = useAppStore((state) => state.accounts);

  const targetAccountId = providedAccountId || currentAccountId;
  const currentAccount = targetAccountId ? accounts.get(targetAccountId) : null;

  const [status, setStatus] = useState<TwoFactorSetupStatus>(TwoFactorSetupStatus.IDLE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const setup2FA = useCallback(
    async (passwordOrEnable: string | boolean, enable?: boolean) => {
      if (!targetAccountId || !currentAccount) {
        const errorMsg = 'No account available for 2FA setup';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        serviceManager.ensureInitialized();
        setStatus(TwoFactorSetupStatus.SETTING_UP);
        setError(null);

        let result;

        // Determine account type and use appropriate API
        if (currentAccount.accountType === AccountType.Local) {
          // Local Auth: requires password
          if (typeof passwordOrEnable !== 'string') {
            throw new Error('Password is required for Local auth accounts');
          }

          const enableTwoFactor = enable ?? true;
          result = await serviceManager.authService.setupTwoFactor(targetAccountId, {
            password: passwordOrEnable,
            enableTwoFactor,
          });
        } else if (currentAccount.accountType === AccountType.OAuth) {
          // OAuth: no password required, uses OAuth token verification
          const enableTwoFactor = typeof passwordOrEnable === 'boolean' ? passwordOrEnable : (enable ?? true);
          result = await serviceManager.authService.setupOAuthTwoFactor(targetAccountId, {
            enableTwoFactor,
          });
        } else {
          throw new Error(`Unsupported account type: ${currentAccount.accountType}`);
        }

        const isEnabling = typeof passwordOrEnable === 'boolean' ? passwordOrEnable : (enable ?? true);

        if (isEnabling) {
          setQrCode(result.qrCode || null);
          setSecret(result.secret || null);
          setBackupCodes(result.backupCodes || null);
          setMessage(result.message || '2FA setup initiated. Please scan the QR code.');
          onSetupComplete?.(result.message || '2FA setup initiated');
        } else {
          setStatus(TwoFactorSetupStatus.COMPLETE);
          setMessage(result.message || '2FA has been disabled.');
          onSetupComplete?.(result.message || '2FA disabled');
        }

        setStatus(isEnabling ? TwoFactorSetupStatus.IDLE : TwoFactorSetupStatus.COMPLETE);
      } catch (err: any) {
        let errorMessage = 'Failed to setup 2FA';

        if (err.statusCode === 400) {
          if (err.code === 'AUTH_FAILED') {
            errorMessage =
              currentAccount.accountType === AccountType.Local
                ? 'Invalid password. Please try again.'
                : 'OAuth token verification failed. Please try again.';
          } else if (err.code === 'VALIDATION_ERROR') {
            errorMessage = err.message || 'Invalid setup request';
          } else {
            errorMessage = err.message || 'Setup validation failed';
          }
        } else if (err.statusCode === 403) {
          errorMessage = 'Access denied. Please ensure you have valid permissions.';
        } else if (err.statusCode === 404) {
          errorMessage = 'Account not found.';
        } else {
          errorMessage = err.message || 'Failed to setup 2FA';
        }

        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [targetAccountId, currentAccount, onSetupComplete, onError],
  );

  const verifySetup = useCallback(
    async (token: string) => {
      if (!targetAccountId || !currentAccount) {
        const errorMsg = 'No account available for 2FA verification';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        serviceManager.ensureInitialized();
        setStatus(TwoFactorSetupStatus.VERIFYING_SETUP);
        setError(null);

        // Use appropriate verification API based on account type
        if (currentAccount.accountType === AccountType.Local) {
          await serviceManager.authService.verifyTwoFactorSetup(targetAccountId, token);
        } else if (currentAccount.accountType === AccountType.OAuth) {
          await serviceManager.authService.verifyOAuthTwoFactorSetup(targetAccountId, token);
        } else {
          throw new Error(`Unsupported account type: ${currentAccount.accountType}`);
        }

        setStatus(TwoFactorSetupStatus.COMPLETE);
        const successMessage = '2FA verification successful! Two-factor authentication is now active.';
        setMessage(successMessage);
        onVerified?.(successMessage);
      } catch (err: any) {
        let errorMessage = 'Failed to verify 2FA setup';

        if (err.statusCode === 400) {
          if (err.code === 'AUTH_FAILED') {
            errorMessage = 'Invalid verification code. Please try again.';
          } else if (err.code === 'VALIDATION_ERROR') {
            errorMessage = err.message || 'Invalid verification code format';
          } else {
            errorMessage = err.message || 'Verification failed';
          }
        } else if (err.statusCode === 404) {
          errorMessage = '2FA setup not found. Please start the setup process again.';
        } else {
          errorMessage = err.message || 'Failed to verify 2FA setup';
        }

        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [targetAccountId, currentAccount, onVerified, onError],
  );

  const generateNewBackupCodes = useCallback(
    async (password?: string) => {
      if (!targetAccountId || !currentAccount) {
        const errorMsg = 'No account available';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        serviceManager.ensureInitialized();

        let newCodes: string[];

        // Use appropriate backup codes API based on account type
        if (currentAccount.accountType === AccountType.Local) {
          if (!password) {
            throw new Error('Password is required for Local auth accounts');
          }
          newCodes = (await serviceManager.authService.generateBackupCodes(targetAccountId, password)).backupCodes;
        } else if (currentAccount.accountType === AccountType.OAuth) {
          // OAuth doesn't require password
          newCodes = (await serviceManager.authService.generateOAuthBackupCodes(targetAccountId)).backupCodes;
        } else {
          throw new Error(`Unsupported account type: ${currentAccount.accountType}`);
        }

        setBackupCodes(newCodes);
        return newCodes;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to generate backup codes';
        setError(errorMessage);
        onError?.(errorMessage);
        throw err;
      }
    },
    [targetAccountId, currentAccount, onError],
  );

  const reset = useCallback(() => {
    setStatus(TwoFactorSetupStatus.IDLE);
    setMessage(null);
    setError(null);
    setQrCode(null);
    setSecret(null);
    setBackupCodes(null);
  }, []);

  return {
    // State
    status,
    message,
    error,
    qrCode,
    secret,
    backupCodes,
    currentAccount,
    accountId: targetAccountId,
    accountType: currentAccount?.accountType,

    // Status checks
    isLoading: [TwoFactorSetupStatus.SETTING_UP, TwoFactorSetupStatus.VERIFYING_SETUP].includes(status),
    isComplete: status === TwoFactorSetupStatus.COMPLETE,
    isError: status === TwoFactorSetupStatus.ERROR,
    isLocalAccount: currentAccount?.accountType === AccountType.Local,
    isOAuthAccount: currentAccount?.accountType === AccountType.OAuth,

    // Actions
    setup2FA,
    verifySetup,
    generateNewBackupCodes,
    reset,
  };
};
