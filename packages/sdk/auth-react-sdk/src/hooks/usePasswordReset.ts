import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export enum PasswordResetStatus {
  IDLE = 'idle',
  REQUESTING = 'requesting',
  REQUEST_SUCCESS = 'request_success',
  RESETTING = 'resetting',
  RESET_SUCCESS = 'reset_success',
  ERROR = 'error',
}

export interface UsePasswordResetOptions {
  onRequestSuccess?: (message: string) => void;
  onResetSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export const usePasswordReset = (options: UsePasswordResetOptions = {}) => {
  const { onRequestSuccess, onResetSuccess, onError } = options;
  const { requestPasswordReset, resetPassword } = useAuth();

  const [status, setStatus] = useState<PasswordResetStatus>(PasswordResetStatus.IDLE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestReset = useCallback(
    async (email: string) => {
      try {
        setStatus(PasswordResetStatus.REQUESTING);
        setError(null);

        await requestPasswordReset(email);

        const successMessage = 'Password reset instructions have been sent to your email.';
        setStatus(PasswordResetStatus.REQUEST_SUCCESS);
        setMessage(successMessage);
        onRequestSuccess?.(successMessage);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to send password reset email';
        setStatus(PasswordResetStatus.ERROR);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [requestPasswordReset, onRequestSuccess, onError],
  );

  const performReset = useCallback(
    async (token: string, password: string, confirmPassword: string) => {
      try {
        setStatus(PasswordResetStatus.RESETTING);
        setError(null);

        await resetPassword(token, { password, confirmPassword });

        const successMessage = 'Password reset successful! You can now sign in with your new password.';
        setStatus(PasswordResetStatus.RESET_SUCCESS);
        setMessage(successMessage);
        onResetSuccess?.(successMessage);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to reset password';
        setStatus(PasswordResetStatus.ERROR);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [resetPassword, onResetSuccess, onError],
  );

  const clearState = useCallback(() => {
    setStatus(PasswordResetStatus.IDLE);
    setMessage(null);
    setError(null);
  }, []);

  return {
    status,
    message,
    error,
    isLoading: status === PasswordResetStatus.REQUESTING || status === PasswordResetStatus.RESETTING,
    requestReset,
    performReset,
    clearState,
  };
};
