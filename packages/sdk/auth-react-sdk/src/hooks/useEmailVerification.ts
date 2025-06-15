import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';

const serviceManager = ServiceManager.getInstance();

export enum EmailVerificationStatus {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
  NO_TOKEN = 'no_token',
  IDLE = 'idle',
}

export interface UseEmailVerificationOptions {
  onSuccess?: (profileToken: string, email: string) => void;
  onError?: (error: string) => void;
  autoVerify?: boolean; // Default true - auto-verify from URL
}

export const useEmailVerification = (options: UseEmailVerificationOptions = {}) => {
  const { onSuccess, onError, autoVerify = true } = options;

  const [status, setStatus] = useState<EmailVerificationStatus>(EmailVerificationStatus.IDLE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const verifyEmail = useCallback(
    async (verificationToken: string) => {
      try {
        setStatus(EmailVerificationStatus.LOADING);
        setError(null);
        setToken(verificationToken);

        // Call the store function directly
        const result = await serviceManager.authService.verifyEmailForSignup(verificationToken);

        setStatus(EmailVerificationStatus.SUCCESS);
        setMessage(result.message);
        setProfileToken(result.profileToken);
        setEmail(result.email);

        onSuccess?.(result.profileToken, result.email);
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
    [onSuccess, onError],
  );

  const manualVerify = useCallback(
    (verificationToken: string) => {
      setToken(verificationToken);
      return verifyEmail(verificationToken);
    },
    [verifyEmail],
  );

  // Auto-verify from URL if enabled
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

    // Auto-verify with the token from URL
    verifyEmail(urlToken);
  }, [autoVerify]);

  const retry = useCallback(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token, verifyEmail]);

  const reset = useCallback(() => {
    setStatus(EmailVerificationStatus.IDLE);
    setMessage(null);
    setError(null);
    setToken(null);
    setProfileToken(null);
    setEmail(null);
  }, []);

  return {
    // Current state
    status,
    message,
    error,
    token,
    profileToken,
    email,

    // Status checks
    isLoading: status === EmailVerificationStatus.LOADING,
    isSuccess: status === EmailVerificationStatus.SUCCESS,
    isError: [
      EmailVerificationStatus.ERROR,
      EmailVerificationStatus.INVALID_TOKEN,
      EmailVerificationStatus.EXPIRED_TOKEN,
    ].includes(status),
    hasToken: !!token,
    hasProfileToken: !!profileToken,

    // Actions
    verify: manualVerify,
    retry,
    reset,

    // Direct verification function (for advanced usage)
    verifyEmail,
  };
};
