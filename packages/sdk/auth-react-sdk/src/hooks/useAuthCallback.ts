import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { CallbackCode, CallbackData, OAuthProviders } from '../types';

type CallbackHandler<T = any> = (data: T) => void | Promise<void>;

interface UseAuthCallbackOptions {
  onOAuthSigninSuccess?: CallbackHandler<{
    accountId: string;
    name: string;
    provider: OAuthProviders;
    needsAdditionalScopes?: boolean;
    missingScopes?: string[];
  }>;
  onOAuthSignupSuccess?: CallbackHandler<{
    accountId: string;
    name: string;
    provider: OAuthProviders;
  }>;
  onOAuthPermissionSuccess?: CallbackHandler<{
    accountId: string;
    service?: string;
    scopeLevel?: string;
    provider: OAuthProviders;
    message?: string;
  }>;
  onTwoFactorRequired?: CallbackHandler<{
    accountId: string;
    tempToken: string;
    provider?: OAuthProviders;
    message?: string;
    isLocal: boolean;
    isOAuth: boolean;
  }>;
  onError?: CallbackHandler<{
    error: string;
    provider?: OAuthProviders;
    code?: CallbackCode;
  }>;
}

interface UseAuthCallbackReturn {
  error: string | null;
  processing: boolean;
  handleAuthCallback: (params: URLSearchParams) => Promise<void>;
  clearError: () => void;
}

export const useAuthCallback = (options: UseAuthCallbackOptions = {}): UseAuthCallbackReturn => {
  const authService = useAuthService();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTempToken = useAppStore((state) => state.setTempToken);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setAccountsData = useAppStore((state) => state.setAccountsData);

  const clearError = () => setError(null);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const sessionResponse = await authService.getAccountSession();
      setSessionData(sessionResponse.session);

      if (sessionResponse.session.accountIds.length > 0) {
        const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
        setAccountsData(accountsData as any[]);
      }
    } catch (error) {
      console.warn('Failed to refresh session after callback:', error);
    }
  }, [authService, setSessionData, setAccountsData]);

  const navigateToRoot = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  const executeCallback = useCallback(
    async (callbackData: CallbackData): Promise<void> => {
      try {
        switch (callbackData.code) {
          case CallbackCode.OAUTH_SIGNIN_SUCCESS: {
            await refreshSession();
            await options.onOAuthSigninSuccess?.({
              accountId: callbackData.accountId!,
              name: callbackData.name!,
              provider: callbackData.provider!,
              needsAdditionalScopes: callbackData.needsAdditionalScopes,
              missingScopes: callbackData.missingScopes,
            });
            break;
          }

          case CallbackCode.OAUTH_SIGNUP_SUCCESS: {
            await refreshSession();
            await options.onOAuthSignupSuccess?.({
              accountId: callbackData.accountId!,
              name: callbackData.name!,
              provider: callbackData.provider!,
            });
            break;
          }

          case CallbackCode.OAUTH_PERMISSION_SUCCESS: {
            await refreshSession();
            await options.onOAuthPermissionSuccess?.({
              accountId: callbackData.accountId!,
              service: callbackData.service,
              scopeLevel: callbackData.scopeLevel,
              provider: callbackData.provider!,
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOCAL_SIGNIN_REQUIRES_2FA: {
            // Store temp token for 2FA verification
            if (callbackData.tempToken) {
              setTempToken(callbackData.tempToken);
            }

            await options.onTwoFactorRequired?.({
              accountId: callbackData.accountId!,
              tempToken: callbackData.tempToken!,
              message: callbackData.message || 'Two-factor authentication required',
              isLocal: true,
              isOAuth: false,
            });
            break;
          }

          case CallbackCode.OAUTH_SIGNIN_REQUIRES_2FA: {
            // Store temp token for 2FA verification
            if (callbackData.tempToken) {
              setTempToken(callbackData.tempToken);
            }

            await options.onTwoFactorRequired?.({
              accountId: callbackData.accountId!,
              tempToken: callbackData.tempToken!,
              provider: callbackData.provider,
              message: callbackData.message || 'Two-factor authentication required',
              isLocal: false,
              isOAuth: true,
            });
            break;
          }

          case CallbackCode.OAUTH_ERROR:
          case CallbackCode.PERMISSION_ERROR:
          default: {
            await options.onError?.({
              error: callbackData.error || 'Unknown callback error',
              provider: callbackData.provider,
              code: callbackData.code,
            });
            break;
          }
        }
      } catch (error) {
        console.error('Error handling callback:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown callback handling error';
        setError(errorMessage);
        navigateToRoot();
      }
    },
    [options, refreshSession, setTempToken, navigateToRoot],
  );

  const handleAuthCallback = useCallback(
    async (params: URLSearchParams) => {
      try {
        setProcessing(true);
        setError(null);

        // Convert all URL parameters to a simple object with decoded values
        const callbackData: CallbackData = {};

        params.forEach((value, key) => {
          const decodedValue = decodeURIComponent(value);

          // Handle arrays - if value contains commas, split into array
          if (decodedValue.includes(',')) {
            callbackData[key] = decodedValue.split(',').map((s) => s.trim());
          } else {
            // Handle boolean values
            if (decodedValue === 'true') {
              callbackData[key] = true;
            } else if (decodedValue === 'false') {
              callbackData[key] = false;
            } else {
              callbackData[key] = decodedValue;
            }
          }
        });

        await executeCallback(callbackData);

        // Clean up URL
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.search = '';
          window.history.replaceState({}, '', url.toString());
        }

        setProcessing(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Auth callback failed';
        setError(message);
        setProcessing(false);
        console.error('Auth callback error:', error);
      }
    },
    [executeCallback],
  );

  return {
    error,
    processing,
    handleAuthCallback,
    clearError,
  };
};
