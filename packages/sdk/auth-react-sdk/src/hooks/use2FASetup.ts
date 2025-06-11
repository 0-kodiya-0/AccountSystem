import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
  TwoFactorSetupStatus,
} from '../types';

export interface Use2FASetupOptions {
  accountId?: string;
  autoGenerateBackupCodes?: boolean;
  redirectAfterComplete?: string;
  redirectDelay?: number;
  onSetupReady?: (qrCode: string, secret: string) => void;
  onVerified?: (message: string) => void;
  onBackupCodesGenerated?: (codes: string[]) => void;
  onComplete?: (backupCodes?: string[]) => void;
  onError?: (error: string) => void;
}

export interface Use2FASetupResult {
  status: TwoFactorSetupStatus;
  qrCode: string | null;
  secret: string | null;
  backupCodes: string[] | null;
  message: string | null;
  error: string | null;
  isLoading: boolean;

  // Actions
  startSetup: (password: string) => Promise<void>;
  verifySetup: (token: string) => Promise<void>;
  generateBackupCodes: (password: string) => Promise<void>;
  downloadBackupCodes: (filename?: string) => void;
  reset: () => void;
  redirect: (url: string) => void;
}

export const use2FASetup = (
  options: Use2FASetupOptions = {},
): Use2FASetupResult => {
  const {
    accountId: providedAccountId,
    autoGenerateBackupCodes = true,
    redirectAfterComplete,
    redirectDelay = 3000,
    onSetupReady,
    onVerified,
    onBackupCodesGenerated,
    onComplete,
    onError,
  } = options;

  const { currentAccount } = useAuth();
  const accountId = providedAccountId || currentAccount?.id;

  const [status, setStatus] = useState<TwoFactorSetupStatus>(
    TwoFactorSetupStatus.IDLE,
  );
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OPTIMIZED: useCallback with no dependencies - pure function
  const redirect = useCallback((url: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, []); // No dependencies - pure function

  // Auth service access
  const {
    setupTwoFactor,
    verifyTwoFactorSetup,
    generateBackupCodes: generateCodes,
  } = useAuth();

  // OPTIMIZED: useCallback with minimal dependencies
  const startSetup = useCallback(
    async (password: string) => {
      if (!accountId) {
        const errorMsg = 'No account ID available for 2FA setup';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        setStatus(TwoFactorSetupStatus.REQUESTING_SETUP);
        setError(null);

        const setupData: TwoFactorSetupRequest = {
          password,
          enableTwoFactor: true,
        };

        const response: TwoFactorSetupResponse =
          await setupTwoFactor(setupData);

        setQrCode(response.qrCode || null);
        setSecret(response.secret || null);
        setStatus(TwoFactorSetupStatus.SETUP_READY);
        setMessage(
          'Scan the QR code with your authenticator app and enter the verification code.',
        );

        onSetupReady?.(response.qrCode || '', response.secret || '');
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to initialize 2FA setup';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [
      accountId, // Changes when account changes
      setupTwoFactor, // Stable from useAuth
      onSetupReady, // Should be stable from parent
      onError, // Should be stable from parent
    ],
  );

  const verifySetup = useCallback(
    async (token: string) => {
      if (!accountId) {
        const errorMsg = 'No account ID available for 2FA verification';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        setStatus(TwoFactorSetupStatus.VERIFYING_TOKEN);
        setError(null);

        const response = await verifyTwoFactorSetup(accountId, token);

        setMessage(response.message || '2FA verification successful!');
        onVerified?.(response.message || '2FA verification successful!');

        // Auto-generate backup codes if enabled
        if (autoGenerateBackupCodes) {
          setStatus(TwoFactorSetupStatus.COMPLETE);
          setMessage(
            '2FA setup complete! Generate backup codes for account recovery.',
          );
          onComplete?.();
        } else {
          setStatus(TwoFactorSetupStatus.COMPLETE);
          setMessage('2FA setup complete!');
          onComplete?.();
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to verify 2FA setup';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [
      accountId, // Changes when account changes
      autoGenerateBackupCodes, // Option that shouldn't change
      verifyTwoFactorSetup, // Stable from useAuth
      onVerified, // Should be stable from parent
      onComplete, // Should be stable from parent
      onError, // Should be stable from parent
    ],
  );

  const generateBackupCodes = useCallback(
    async (password: string) => {
      if (!accountId) {
        const errorMsg = 'No account ID available for backup code generation';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      try {
        setStatus(TwoFactorSetupStatus.GENERATING_BACKUP_CODES);
        setError(null);

        const response = await generateCodes(accountId, password);

        setBackupCodes(response.backupCodes);
        setStatus(TwoFactorSetupStatus.COMPLETE);
        setMessage(
          '2FA setup complete! Save your backup codes in a safe place.',
        );

        onBackupCodesGenerated?.(response.backupCodes);
        onComplete?.(response.backupCodes);
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to generate backup codes';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [
      accountId, // Changes when account changes
      generateCodes, // Stable from useAuth
      onBackupCodesGenerated, // Should be stable from parent
      onComplete, // Should be stable from parent
      onError, // Should be stable from parent
    ],
  );

  // OPTIMIZED: useCallback with minimal dependencies
  const downloadBackupCodes = useCallback(
    (filename: string = 'backup-codes.txt') => {
      if (!backupCodes || backupCodes.length === 0) {
        return;
      }

      const content = [
        '2FA Backup Codes',
        '=================',
        '',
        'Save these backup codes in a safe place.',
        'Each code can only be used once.',
        '',
        ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
        '',
        `Generated on: ${new Date().toLocaleString()}`,
        `Account: ${currentAccount?.userDetails.email || 'Unknown'}`,
      ].join('\n');

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [
      backupCodes, // Changes when backup codes are generated
      currentAccount?.userDetails.email, // Changes when account email changes
    ],
  );

  const reset = useCallback(() => {
    setStatus(TwoFactorSetupStatus.IDLE);
    setQrCode(null);
    setSecret(null);
    setBackupCodes(null);
    setMessage(null);
    setError(null);
  }, []); // No dependencies - pure function

  // OPTIMIZED: Auto-redirect effect - only runs when needed
  useEffect(() => {
    if (
      !redirectAfterComplete ||
      status !== TwoFactorSetupStatus.COMPLETE ||
      redirectDelay <= 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      redirect(redirectAfterComplete);
    }, redirectDelay);

    return () => clearTimeout(timer);
  }, [
    redirectAfterComplete, // Option that shouldn't change
    status, // Changes when setup status changes
    redirectDelay, // Option that shouldn't change
    redirect, // Stable callback
  ]);

  return {
    status,
    qrCode,
    secret,
    backupCodes,
    message,
    error,
    isLoading:
      status === TwoFactorSetupStatus.REQUESTING_SETUP ||
      status === TwoFactorSetupStatus.VERIFYING_TOKEN ||
      status === TwoFactorSetupStatus.GENERATING_BACKUP_CODES,
    startSetup,
    verifySetup,
    generateBackupCodes,
    downloadBackupCodes,
    reset,
    redirect,
  };
};
