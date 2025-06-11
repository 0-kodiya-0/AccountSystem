import { useState, useEffect, useCallback } from 'react';
import { EmailVerificationStatus } from '../types';
import { useServices } from './core/useServices';

export interface UseEmailVerificationOptions {
  token: string | null;
  autoVerify?: boolean;
  redirectAfterSuccess?: string;
  redirectDelay?: number;
  onSuccess?: (message?: string) => void;
  onError?: (error: string) => void;
}

export interface UseEmailVerificationResult {
  status: EmailVerificationStatus;
  message: string | null;
  error: string | null;
  isLoading: boolean;

  // Actions
  verify: () => Promise<void>;
  retry: () => Promise<void>;
  redirect: (url: string) => void;
}

export const useEmailVerification = (
  options: UseEmailVerificationOptions,
): UseEmailVerificationResult => {
  const {
    token,
    autoVerify = true,
    redirectAfterSuccess,
    redirectDelay = 3000,
    onSuccess,
    onError,
  } = options;

  const { authService: client } = useServices();

  const [status, setStatus] = useState<EmailVerificationStatus>(
    token
      ? EmailVerificationStatus.LOADING
      : EmailVerificationStatus.INVALID_TOKEN,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirect = useCallback((url: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, []);

  const verify = useCallback(async () => {
    if (!token) {
      setStatus(EmailVerificationStatus.INVALID_TOKEN);
      setError('No verification token provided');
      return;
    }

    try {
      setStatus(EmailVerificationStatus.LOADING);

      await client.verifyEmail(token);

      const successMessage =
        'Email verified successfully! Your account is now active.';
      setStatus(EmailVerificationStatus.SUCCESS);
      setMessage(successMessage);

      onSuccess?.(successMessage);

      // Auto redirect after success
      if (redirectAfterSuccess) {
        setTimeout(() => {
          redirect(redirectAfterSuccess);
        }, redirectDelay);
      }
    } catch (err: any) {
      let errorStatus = EmailVerificationStatus.ERROR;
      let errorMessage = 'Email verification failed';

      // Parse specific error types
      if (err.message?.includes('token') && err.message?.includes('expired')) {
        errorStatus = EmailVerificationStatus.EXPIRED_TOKEN;
        errorMessage =
          'Verification link has expired. Please request a new one.';
      } else if (
        err.message?.includes('token') &&
        err.message?.includes('invalid')
      ) {
        errorStatus = EmailVerificationStatus.INVALID_TOKEN;
        errorMessage =
          'Invalid verification link. Please check the link or request a new one.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setStatus(errorStatus);
      setError(errorMessage);

      onError?.(errorMessage);
    }
  }, [
    token,
    client,
    setError,
    onSuccess,
    onError,
    redirectAfterSuccess,
    redirectDelay,
    redirect,
  ]);

  const retry = useCallback(async () => {
    await verify();
  }, [verify]);

  // Auto-verify on mount if token exists
  useEffect(() => {
    if (autoVerify && token && status === EmailVerificationStatus.LOADING) {
      verify();
    }
  }, [autoVerify, token, status]);

  return {
    status,
    message,
    error,
    isLoading: status === EmailVerificationStatus.LOADING,
    verify,
    retry,
    redirect,
  };
};
