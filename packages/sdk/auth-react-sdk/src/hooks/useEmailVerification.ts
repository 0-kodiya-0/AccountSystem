import { useState } from 'react';
import { useAuthService } from '../context/ServicesProvider';
import { parseApiError } from '../utils';

interface UseEmailVerificationReturn {
  verify: (token: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  isVerified: boolean;
  profileToken: string | null;
  email: string | null;
  clearError: () => void;
  reset: () => void;
}

export const useEmailVerification = (): UseEmailVerificationReturn => {
  const authService = useAuthService();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const clearError = () => setError(null);

  const reset = () => {
    setError(null);
    setIsVerified(false);
    setProfileToken(null);
    setEmail(null);
  };

  const verify = async (token: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.verifyEmailForSignup(token);

      if (result.profileToken) {
        setIsVerified(true);
        setProfileToken(result.profileToken);
        setEmail(result.email || null);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      const apiError = parseApiError(error, 'Email verification failed');
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
    profileToken,
    email,
    clearError,
    reset,
  };
};
