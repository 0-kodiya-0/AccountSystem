import { useState, useCallback } from 'react';

export enum EmailVerificationStatus {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
}

export interface UseEmailVerificationOptions {
  token: string | null;
  onSuccess?: (message?: string) => void;
  onError?: (error: string) => void;
}

export const useEmailVerification = (options: UseEmailVerificationOptions) => {
  const { token, onSuccess, onError } = options;

  const [status, setStatus] = useState<EmailVerificationStatus>(
    token ? EmailVerificationStatus.LOADING : EmailVerificationStatus.INVALID_TOKEN,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    if (!token) {
      setStatus(EmailVerificationStatus.INVALID_TOKEN);
      setError('No verification token provided');
      return;
    }

    try {
      setStatus(EmailVerificationStatus.LOADING);

      const response = await fetch('/auth/verify-email', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const successMessage = 'Email verified successfully! Your account is now active.';
        setStatus(EmailVerificationStatus.SUCCESS);
        setMessage(successMessage);
        onSuccess?.(successMessage);
      } else {
        throw new Error('Verification failed');
      }
    } catch (err: any) {
      let errorStatus = EmailVerificationStatus.ERROR;
      let errorMessage = 'Email verification failed';

      if (err.message?.includes('token') && err.message?.includes('expired')) {
        errorStatus = EmailVerificationStatus.EXPIRED_TOKEN;
        errorMessage = 'Verification link has expired. Please request a new one.';
      } else if (err.message?.includes('token') && err.message?.includes('invalid')) {
        errorStatus = EmailVerificationStatus.INVALID_TOKEN;
        errorMessage = 'Invalid verification link. Please check the link or request a new one.';
      }

      setStatus(errorStatus);
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [token, onSuccess, onError]);

  return {
    status,
    message,
    error,
    isLoading: status === EmailVerificationStatus.LOADING,
    verify,
  };
};
