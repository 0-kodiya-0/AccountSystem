import { useState, useCallback, useEffect } from 'react';
import { ServiceManager } from '../services/ServiceManager';

const serviceManager = ServiceManager.getInstance();

export enum PasswordResetStatus {
  IDLE = 'idle',
  RESETTING = 'resetting',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
  NO_TOKEN = 'no_token',
}

export interface UsePasswordResetOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  autoReset?: boolean; // Default false - only reset when performReset is called
}

export const usePasswordReset = (options: UsePasswordResetOptions = {}) => {
  const { onSuccess, onError, autoReset = false } = options;

  const [status, setStatus] = useState<PasswordResetStatus>(PasswordResetStatus.IDLE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const performReset = useCallback(
    async (resetToken: string, password: string, confirmPassword: string) => {
      try {
        serviceManager.ensureInitialized();

        setStatus(PasswordResetStatus.RESETTING);
        setError(null);
        setToken(resetToken);

        // Call the service directly
        await serviceManager.authService.resetPassword(resetToken, { password, confirmPassword });

        const successMessage = 'Password reset successful! You can now sign in with your new password.';
        setStatus(PasswordResetStatus.SUCCESS);
        setMessage(successMessage);
        onSuccess?.(successMessage);
      } catch (err: any) {
        let errorStatus = PasswordResetStatus.ERROR;
        let errorMessage = 'Failed to reset password';

        // Handle errors based on HTTP status codes or error codes
        if (err.statusCode === 400) {
          if (err.code === 'TOKEN_INVALID') {
            errorStatus = PasswordResetStatus.INVALID_TOKEN;
            errorMessage = 'Invalid reset link. Please request a new password reset.';
          } else if (err.code === 'TOKEN_EXPIRED') {
            errorStatus = PasswordResetStatus.EXPIRED_TOKEN;
            errorMessage = 'Reset link has expired. Please request a new password reset.';
          } else if (err.code === 'VALIDATION_ERROR') {
            errorMessage = err.message || 'Password validation failed';
          } else {
            errorMessage = err.message || 'Invalid reset request';
          }
        } else if (err.statusCode === 404) {
          errorStatus = PasswordResetStatus.INVALID_TOKEN;
          errorMessage = 'Reset token not found. Please request a new password reset.';
        } else {
          errorMessage = err.message || 'Failed to reset password';
        }

        setStatus(errorStatus);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [serviceManager, onSuccess, onError],
  );

  const manualReset = useCallback(
    (resetToken: string, password: string, confirmPassword: string) => {
      setToken(resetToken);
      return performReset(resetToken, password, confirmPassword);
    },
    [performReset],
  );

  // Auto-extract token from URL if autoReset is enabled
  useEffect(() => {
    if (!autoReset) return;

    // Extract token from current URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (!urlToken) {
      setStatus(PasswordResetStatus.NO_TOKEN);
      setError('No reset token found in URL');
      return;
    }

    setToken(urlToken);
    setStatus(PasswordResetStatus.IDLE); // Ready to reset with token
  }, [autoReset]);

  const retry = useCallback(
    (password: string, confirmPassword: string) => {
      if (token) {
        performReset(token, password, confirmPassword);
      }
    },
    [token, performReset],
  );

  const reset = useCallback(() => {
    setStatus(PasswordResetStatus.IDLE);
    setMessage(null);
    setError(null);
    setToken(null);
  }, []);

  return {
    // Current state
    status,
    message,
    error,
    token,

    // Status checks
    isLoading: status === PasswordResetStatus.RESETTING,
    isSuccess: status === PasswordResetStatus.SUCCESS,
    isError: [PasswordResetStatus.ERROR, PasswordResetStatus.INVALID_TOKEN, PasswordResetStatus.EXPIRED_TOKEN].includes(
      status,
    ),
    hasToken: !!token,

    // Actions
    performReset: token
      ? (password: string, confirmPassword: string) => performReset(token, password, confirmPassword)
      : manualReset,
    retry,
    reset,

    // Direct reset function (for advanced usage)
    resetPassword: performReset,
  };
};
