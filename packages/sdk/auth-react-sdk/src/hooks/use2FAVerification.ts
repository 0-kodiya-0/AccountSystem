import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export enum TwoFactorVerificationStatus {
  IDLE = 'idle',
  VERIFYING = 'verifying',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_SESSION = 'expired_session',
  LOCKED_OUT = 'locked_out',
}

export interface Use2FAVerificationOptions {
  tempToken?: string;
  maxAttempts?: number;
  onSuccess?: (accountId: string, name?: string) => void;
  onError?: (error: string, attemptsRemaining?: number) => void;
  onLockout?: (lockoutDuration: number) => void;
}

export const use2FAVerification = (options: Use2FAVerificationOptions = {}) => {
  const { tempToken, maxAttempts = 5, onSuccess, onError, onLockout } = options;

  const { verifyTwoFactor, tempToken: savedTempToken } = useAuth();
  const activeTempToken = tempToken || savedTempToken;

  const [status, setStatus] = useState<TwoFactorVerificationStatus>(
    activeTempToken ? TwoFactorVerificationStatus.IDLE : TwoFactorVerificationStatus.EXPIRED_SESSION,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(maxAttempts);

  const verify = useCallback(
    async (token: string, isBackupCode: boolean = false) => {
      if (!activeTempToken) {
        setStatus(TwoFactorVerificationStatus.EXPIRED_SESSION);
        setError('Session expired. Please sign in again.');
        return;
      }

      if (status === TwoFactorVerificationStatus.LOCKED_OUT) {
        return;
      }

      try {
        setStatus(TwoFactorVerificationStatus.VERIFYING);
        setError(null);

        const result = await verifyTwoFactor({
          token,
          tempToken: activeTempToken,
        });

        if (result.accountId) {
          setStatus(TwoFactorVerificationStatus.SUCCESS);
          setMessage('Welcome back! Authentication successful.');
          setAttemptsRemaining(null);

          onSuccess?.(result.accountId, result.name);
        } else {
          throw new Error('Verification failed - no account ID returned');
        }
      } catch (err: any) {
        const newAttemptsRemaining = (attemptsRemaining || maxAttempts) - 1;
        setAttemptsRemaining(newAttemptsRemaining);

        let errorMessage = 'Invalid verification code';
        let errorStatus = TwoFactorVerificationStatus.INVALID_TOKEN;

        if (err.message?.includes('expired') || err.message?.includes('timeout')) {
          errorStatus = TwoFactorVerificationStatus.EXPIRED_SESSION;
          errorMessage = 'Session expired. Please sign in again.';
        } else if (err.message?.includes('invalid') || err.message?.includes('incorrect')) {
          errorMessage = isBackupCode ? 'Invalid backup code' : 'Invalid verification code';
          if (newAttemptsRemaining > 0) {
            errorMessage += `. ${newAttemptsRemaining} attempts remaining.`;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }

        if (newAttemptsRemaining <= 0) {
          setStatus(TwoFactorVerificationStatus.LOCKED_OUT);
          onLockout?.(300000); // 5 minutes
          return;
        }

        setStatus(errorStatus);
        setError(errorMessage);
        onError?.(errorMessage, newAttemptsRemaining);
      }
    },
    [activeTempToken, status, attemptsRemaining, maxAttempts, verifyTwoFactor, onSuccess, onError, onLockout],
  );

  const useBackupCode = useCallback(
    async (code: string) => {
      await verify(code, true);
    },
    [verify],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startOver = useCallback(() => {
    setStatus(activeTempToken ? TwoFactorVerificationStatus.IDLE : TwoFactorVerificationStatus.EXPIRED_SESSION);
    setMessage(null);
    setError(null);
    setAttemptsRemaining(maxAttempts);
  }, [activeTempToken, maxAttempts]);

  return {
    status,
    message,
    error,
    attemptsRemaining,
    isLoading: status === TwoFactorVerificationStatus.VERIFYING,
    canRetry:
      status !== TwoFactorVerificationStatus.LOCKED_OUT &&
      status !== TwoFactorVerificationStatus.EXPIRED_SESSION &&
      (attemptsRemaining === null || attemptsRemaining > 0),
    verify,
    useBackupCode,
    clearError,
    startOver,
  };
};
