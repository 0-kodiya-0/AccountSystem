import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

export enum EmailVerificationStatus {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
  NO_TOKEN = 'no_token',
}

export interface UseEmailVerificationOptions {
  onSuccess?: (message?: string) => void;
  onError?: (error: string) => void;
  autoVerify?: boolean; // Default true
}

export const useEmailVerification = (options: UseEmailVerificationOptions = {}) => {
  const { onSuccess, onError, autoVerify = true } = options;
  const { verifyEmail: authVerifyEmail } = useAuth();

  const [status, setStatus] = useState<EmailVerificationStatus>(EmailVerificationStatus.LOADING);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const verifyEmail = useCallback(
    async (verificationToken: string) => {
      try {
        setStatus(EmailVerificationStatus.LOADING);
        setError(null);

        await authVerifyEmail(verificationToken);

        const successMessage = 'Email verified successfully! Your account is now active.';
        setStatus(EmailVerificationStatus.SUCCESS);
        setMessage(successMessage);
        onSuccess?.(successMessage);
      } catch (err: any) {
        let errorStatus = EmailVerificationStatus.ERROR;
        let errorMessage = 'Email verification failed';

        // Handle errors based on HTTP status codes or error codes
        if (err.statusCode === 400) {
          if (err.code === 'TOKEN_INVALID') {
            errorStatus = EmailVerificationStatus.INVALID_TOKEN;
            errorMessage = 'Invalid verification link. Please check the link or request a new one.';
          } else if (err.code === 'TOKEN_EXPIRED') {
            errorStatus = EmailVerificationStatus.EXPIRED_TOKEN;
            errorMessage = 'Verification link has expired. Please request a new one.';
          } else {
            errorMessage = err.message || 'Invalid verification request';
          }
        } else if (err.statusCode === 404) {
          errorStatus = EmailVerificationStatus.INVALID_TOKEN;
          errorMessage = 'Verification token not found. Please request a new verification email.';
        } else {
          errorMessage = err.message || 'Email verification failed';
        }

        setStatus(errorStatus);
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [authVerifyEmail, onSuccess, onError],
  );

  const manualVerify = useCallback(
    (verificationToken: string) => {
      setToken(verificationToken);
      return verifyEmail(verificationToken);
    },
    [verifyEmail],
  );

  // Extract token from URL and auto-verify
  useEffect(() => {
    if (!autoVerify) return;

    // Extract token from current URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (!urlToken) {
      setStatus(EmailVerificationStatus.NO_TOKEN);
      setError('No verification token found in URL');
      return;
    }

    setToken(urlToken);
    verifyEmail(urlToken);
  }, []);

  const retry = useCallback(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token, verifyEmail]);

  return {
    status,
    message,
    error,
    token,
    isLoading: status === EmailVerificationStatus.LOADING,
    isSuccess: status === EmailVerificationStatus.SUCCESS,
    isError: [
      EmailVerificationStatus.ERROR,
      EmailVerificationStatus.INVALID_TOKEN,
      EmailVerificationStatus.EXPIRED_TOKEN,
    ].includes(status),
    verify: manualVerify,
    retry,
  };
};
