import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export enum TwoFactorSetupStatus {
  IDLE = 'idle',
  REQUESTING_SETUP = 'requesting_setup',
  SETUP_READY = 'setup_ready',
  VERIFYING_TOKEN = 'verifying_token',
  GENERATING_BACKUP_CODES = 'generating_backup_codes',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export interface Use2FASetupOptions {
  accountId?: string;
  onSetupReady?: (qrCode: string, secret: string) => void;
  onVerified?: (message: string) => void;
  onBackupCodesGenerated?: (codes: string[]) => void;
  onComplete?: (backupCodes?: string[]) => void;
  onError?: (error: string) => void;
}

export const use2FASetup = (options: Use2FASetupOptions = {}) => {
  const {
    accountId: providedAccountId,
    onSetupReady,
    onVerified,
    onBackupCodesGenerated,
    onComplete,
    onError,
  } = options;

  const { currentAccount, setupTwoFactor, verifyTwoFactorSetup, generateBackupCodes } = useAuth();
  const accountId = providedAccountId || currentAccount?.id;

  const [status, setStatus] = useState<TwoFactorSetupStatus>(TwoFactorSetupStatus.IDLE);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        const response = await setupTwoFactor(accountId, {
          password,
          enableTwoFactor: true,
        });

        setQrCode(response.qrCode || null);
        setSecret(response.secret || null);
        setStatus(TwoFactorSetupStatus.SETUP_READY);
        setMessage('Scan the QR code with your authenticator app and enter the verification code.');

        onSetupReady?.(response.qrCode || '', response.secret || '');
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to initialize 2FA setup';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [accountId, setupTwoFactor, onSetupReady, onError],
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

        await verifyTwoFactorSetup(accountId, token);

        setMessage('2FA verification successful!');
        onVerified?.('2FA verification successful!');

        setStatus(TwoFactorSetupStatus.COMPLETE);
        setMessage('2FA setup complete!');
        onComplete?.();
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to verify 2FA setup';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [accountId, verifyTwoFactorSetup, onVerified, onComplete, onError],
  );

  const generateCodes = useCallback(
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

        const codes = await generateBackupCodes(accountId, password);

        setBackupCodes(codes);
        setStatus(TwoFactorSetupStatus.COMPLETE);
        setMessage('2FA setup complete! Save your backup codes in a safe place.');

        onBackupCodesGenerated?.(codes);
        onComplete?.(codes);
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to generate backup codes';
        setStatus(TwoFactorSetupStatus.ERROR);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [accountId, generateBackupCodes, onBackupCodesGenerated, onComplete, onError],
  );

  const reset = useCallback(() => {
    setStatus(TwoFactorSetupStatus.IDLE);
    setQrCode(null);
    setSecret(null);
    setBackupCodes(null);
    setMessage(null);
    setError(null);
  }, []);

  return {
    status,
    qrCode,
    secret,
    backupCodes,
    message,
    error,
    isLoading: [
      TwoFactorSetupStatus.REQUESTING_SETUP,
      TwoFactorSetupStatus.VERIFYING_TOKEN,
      TwoFactorSetupStatus.GENERATING_BACKUP_CODES,
    ].includes(status),
    startSetup,
    verifySetup,
    generateCodes,
    reset,
  };
};
