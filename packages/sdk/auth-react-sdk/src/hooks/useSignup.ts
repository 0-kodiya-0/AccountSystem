import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { RequestEmailVerificationRequest, CompleteProfileRequest, CancelSignupRequest, OAuthProviders } from '../types';
import { parseApiError } from '../utils';

type SignupStep = 'email_verification' | 'profile_completion' | 'completed' | null;

interface UseSignupReturn {
  requestEmailVerification: (data: RequestEmailVerificationRequest) => Promise<boolean>;
  completeProfile: (token: string, data: CompleteProfileRequest) => Promise<boolean>;
  getSignupStatus: (email?: string, token?: string) => Promise<any>;
  cancelSignup: (data: CancelSignupRequest) => Promise<boolean>;
  startOAuthSignup: (provider: OAuthProviders) => void;
  getOAuthSignupUrl: (provider: OAuthProviders) => Promise<string>;
  loading: boolean;
  error: string | null;
  step: SignupStep;
  clearError: () => void;
}

export const useSignup = (): UseSignupReturn => {
  const authService = useAuthService();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SignupStep>(null);

  const setSessionData = useAppStore((state) => state.setSessionData);
  const setAccountsData = useAppStore((state) => state.setAccountsData);

  const clearError = () => setError(null);

  const initializeSession = async () => {
    try {
      const sessionResponse = await authService.getAccountSession();
      setSessionData(sessionResponse.session);

      if (sessionResponse.session.accountIds.length > 0) {
        const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
        setAccountsData(accountsData as any[]);
      }
    } catch (error) {
      console.warn('Failed to initialize session after signup:', error);
    }
  };

  const requestEmailVerification = async (data: RequestEmailVerificationRequest): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.requestEmailVerification(data);

      if (result.token) {
        setStep('email_verification');
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      const apiError = parseApiError(error, 'Email verification request failed');
      setError(apiError.message);
      setLoading(false);
      return false;
    }
  };

  const completeProfile = async (token: string, data: CompleteProfileRequest): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.completeProfile(token, data);

      if (result.accountId) {
        // Profile completed successfully, initialize session
        await initializeSession();
        setStep('completed');
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      const apiError = parseApiError(error, 'Profile completion failed');
      setError(apiError.message);
      setLoading(false);
      return false;
    }
  };

  const getSignupStatus = useCallback(
    async (email?: string, token?: string) => {
      try {
        setLoading(true);
        setError(null);

        const result = await authService.getSignupStatus(email, token);

        // Update step based on status
        if (result.step) {
          setStep(result.step as SignupStep);
        }

        setLoading(false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get signup status');
        setError(apiError.message);
        setLoading(false);
        return null;
      }
    },
    [authService],
  );

  const cancelSignup = async (data: CancelSignupRequest): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.cancelSignup(data);

      if (result) {
        setStep(null);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      const apiError = parseApiError(error, 'Cancel signup failed');
      setError(apiError.message);
      setLoading(false);
      return false;
    }
  };

  const startOAuthSignup = (provider: OAuthProviders) => {
    try {
      setError(null);
      authService.redirectToOAuthSignup(provider);
    } catch (error) {
      const apiError = parseApiError(error, 'OAuth signup failed');
      setError(apiError.message);
    }
  };

  const getOAuthSignupUrl = async (provider: OAuthProviders): Promise<string> => {
    try {
      setError(null);
      const response = await authService.generateOAuthSignupUrl(provider);
      return response.authorizationUrl;
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to get OAuth signup URL');
      setError(apiError.message);
      return '';
    }
  };

  return {
    requestEmailVerification,
    completeProfile,
    getSignupStatus,
    cancelSignup,
    startOAuthSignup,
    getOAuthSignupUrl,
    loading,
    error,
    step,
    clearError,
  };
};
