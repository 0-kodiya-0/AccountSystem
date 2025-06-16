import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { LocalLoginRequest, OAuthProviders } from '../types';
import { parseApiError } from '../utils';

interface UseSigninReturn {
  signin: (data: LocalLoginRequest) => Promise<boolean>;
  startOAuthSignin: (provider: OAuthProviders) => void;
  getOAuthSigninUrl: (provider: OAuthProviders) => Promise<string>;
  loading: boolean;
  error: string | null;
  requiresTwoFactor: boolean;
  tempToken: string | null;
  clearError: () => void;
}

export const useSignin = (): UseSigninReturn => {
  const authService = useAuthService();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const tempToken = useAppStore((state) => state.tempToken);
  const setTempToken = useAppStore((state) => state.setTempToken);
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
      console.warn('Failed to initialize session after signin:', error);
    }
  };

  const signin = async (data: LocalLoginRequest): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setRequiresTwoFactor(false);

      const result = await authService.localLogin(data);

      if (result.requiresTwoFactor && result.tempToken) {
        // 2FA required
        setTempToken(result.tempToken);
        setRequiresTwoFactor(true);
        setLoading(false);
        return false; // Signin not complete, 2FA needed
      } else {
        // Signin successful
        await initializeSession();
        setRequiresTwoFactor(false);
        setLoading(false);
        return true; // Signin complete
      }
    } catch (error) {
      const apiError = parseApiError(error, 'Signin failed');
      setError(apiError.message);
      setLoading(false);
      setRequiresTwoFactor(false);
      return false;
    }
  };

  const startOAuthSignin = (provider: OAuthProviders) => {
    try {
      setError(null);
      authService.redirectToOAuthSignin(provider);
    } catch (error) {
      const apiError = parseApiError(error, 'OAuth signin failed');
      setError(apiError.message);
    }
  };

  const getOAuthSigninUrl = async (provider: OAuthProviders): Promise<string> => {
    try {
      setError(null);
      const response = await authService.generateOAuthSigninUrl(provider);
      return response.authorizationUrl;
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to get OAuth signin URL');
      setError(apiError.message);
      return '';
    }
  };

  return {
    signin,
    startOAuthSignin,
    getOAuthSigninUrl,
    loading,
    error,
    requiresTwoFactor,
    tempToken,
    clearError,
  };
};
