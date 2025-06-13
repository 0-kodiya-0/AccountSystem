import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export enum TwoFactorSetupStatus {
  IDLE = 'idle',
  VERIFYING_TOKEN = 'verifying_token',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export interface Use2FASetupOptions {
  accountId?: string;
  onVerified?: (message: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const use2FASetup = (options: Use2FASetupOptions = {}) => {
  const { accountId: providedAccountId, onVerified, onComplete, onError } = options;

  const { currentAccount, verifyTwoFactorSetup } = useAuth();
  const accountId = providedAccountId || currentAccount?.id;

  const [status, setStatus] = useState<TwoFactorSetupStatus>(TwoFactorSetupStatus.IDLE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        let errorMessage = 'Failed to verify 2FA setup';

        // Handle errors based on HTTP status codes or error codes
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
    [accountId, verifyTwoFactorSetup, onVerified, onComplete, onError],
  );

  const reset = useCallback(() => {
    setStatus(TwoFactorSetupStatus.IDLE);
    setMessage(null);
    setError(null);
  }, []);

  return {
    status,
    message,
    error,
    isLoading: status === TwoFactorSetupStatus.VERIFYING_TOKEN,
    isComplete: status === TwoFactorSetupStatus.COMPLETE,
    isError: status === TwoFactorSetupStatus.ERROR,
    verifySetup,
    reset,
  };
};
