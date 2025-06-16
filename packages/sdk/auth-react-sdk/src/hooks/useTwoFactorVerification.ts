import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { parseApiError } from '../utils';

interface UseTwoFactorVerificationReturn {
  verify: (token: string, tempToken?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  isVerified: boolean;
  clearError: () => void;
  reset: () => void;
}

export const useTwoFactorVerification = (): UseTwoFactorVerificationReturn => {
  const authService = useAuthService();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const tempToken = useAppStore((state) => state.tempToken);
  const clearTempToken = useAppStore((state) => state.clearTempToken);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setAccountsData = useAppStore((state) => state.setAccountsData);

  const clearError = () => setError(null);

  const reset = () => {
    setError(null);
    setIsVerified(false);
  };

  const initializeSession = async () => {
    try {
      const sessionResponse = await authService.getAccountSession();
      setSessionData(sessionResponse.session);

      if (sessionResponse.session.accountIds.length > 0) {
        const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
        setAccountsData(accountsData as any[]);
      }
    } catch (error) {
      console.warn('Failed to initialize session after 2FA verification:', error);
    }
  };

  const verify = async (token: string, tempTokenToUse?: string): Promise<boolean> => {
    const tokenToUse = tempTokenToUse || tempToken;

    if (!tokenToUse) {
      setError('No temporary token available for 2FA verification');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await authService.verifyTwoFactorLogin({
        token,
        tempToken: tokenToUse,
      });

      if (result.accountId) {
        // 2FA verification successful
        clearTempToken();
        await initializeSession();
        setIsVerified(true);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      const apiError = parseApiError(error, '2FA verification failed');
      setError(apiError.message);
      setLoading(false);
      setIsVerified(false);
      return false;
    }
  };

  return {
    verify,
    loading,
    error,
    isVerified,
    clearError,
    reset,
  };
};
