import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';

// Get ServiceManager instance at module level
const serviceManager = ServiceManager.getInstance();

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
  maxAttempts?: number; // Default 5
  onSuccess?: (accountId: string, name?: string) => void;
  onError?: (error: string, attemptsRemaining?: number) => void;
  onLockout?: (lockoutDuration: number) => void;
}

export const use2FAVerification = (options: Use2FAVerificationOptions = {}) => {
  const { tempToken, maxAttempts = 5, onSuccess, onError, onLockout } = options;

  // Get temp token from store if not provided
  const storedTempToken = useAppStore((state) => state.tempToken);
  const activeTempToken = tempToken || storedTempToken;

  // Get store actions
  const refreshSession = useAppStore((state) => state.initializeSession);

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
        serviceManager.ensureInitialized();
        setStatus(TwoFactorVerificationStatus.VERIFYING);
        setError(null);

        const result = await serviceManager.authService.verifyTwoFactor({
          token,
          tempToken: activeTempToken,
        });

        if (result.accountId) {
          setStatus(TwoFactorVerificationStatus.SUCCESS);
          setMessage('Welcome back! Authentication successful.');
          setAttemptsRemaining(null);

          // Refresh session to get updated state
          await refreshSession();

          onSuccess?.(result.accountId, result.name);
        } else {
          throw new Error('Verification failed - no account ID returned');
        }
      } catch (err: any) {
        const newAttemptsRemaining = (attemptsRemaining || maxAttempts) - 1;
        setAttemptsRemaining(newAttemptsRemaining);

        let errorMessage = 'Invalid verification code';
        let errorStatus = TwoFactorVerificationStatus.INVALID_TOKEN;

        // Handle errors based on HTTP status codes or error codes
        if (err.statusCode === 401) {
          if (err.code === 'TOKEN_INVALID') {
            errorStatus = TwoFactorVerificationStatus.EXPIRED_SESSION;
            errorMessage = 'Session expired. Please sign in again.';
          } else if (err.code === 'AUTH_FAILED') {
            errorMessage = isBackupCode ? 'Invalid backup code' : 'Invalid verification code';
            if (newAttemptsRemaining > 0) {
              errorMessage += `. ${newAttemptsRemaining} attempts remaining.`;
            }
          } else {
            errorMessage = err.message || 'Authentication failed';
          }
        } else if (err.statusCode === 400) {
          if (err.code === 'VALIDATION_ERROR') {
            errorMessage = err.message || 'Invalid verification code format';
          } else {
            errorMessage = err.message || 'Invalid verification request';
          }
        } else {
          errorMessage = err.message || 'Verification failed';
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
    [activeTempToken, status, attemptsRemaining, maxAttempts, refreshSession, onSuccess, onError, onLockout],
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
    // State
    status,
    message,
    error,
    attemptsRemaining,
    tempToken: activeTempToken,

    // Status checks
    isLoading: status === TwoFactorVerificationStatus.VERIFYING,
    canRetry:
      status !== TwoFactorVerificationStatus.LOCKED_OUT &&
      status !== TwoFactorVerificationStatus.EXPIRED_SESSION &&
      (attemptsRemaining === null || attemptsRemaining > 0),

    // Actions
    verify,
    useBackupCode,
    clearError,
    startOver,
  };
};
