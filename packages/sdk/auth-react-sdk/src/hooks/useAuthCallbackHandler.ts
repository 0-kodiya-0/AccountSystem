import { CallbackCode, CallbackData, OAuthProviders } from '../types';
import { useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from './useAuth';

type CallbackHandler<T = any> = (data: T) => void | Promise<void>;

interface UseCallbackHandlerOptions {
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
  // Two-factor authentication handlers
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

interface UseCallbackHandlerReturn {
  error: string | null;
  handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useAuthCallbackHandler = (options: UseCallbackHandlerOptions = {}): UseCallbackHandlerReturn => {
  const setTempToken = useAppStore((state) => state.setTempToken);
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
            options.onOAuthSigninSuccess?.({
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
            options.onOAuthSignupSuccess?.({
              accountId: callbackData.accountId!,
              name: callbackData.name!,
              provider: callbackData.provider!,
            });
            break;
          }

          case CallbackCode.OAUTH_PERMISSION_SUCCESS: {
            await refreshSession();
            options.onOAuthPermissionSuccess?.({
              accountId: callbackData.accountId!,
              service: callbackData.service,
              scopeLevel: callbackData.scopeLevel,
              provider: callbackData.provider!,
              message: callbackData.message,
            });
            break;
          }

          // NEW: Handle 2FA required scenarios
          case CallbackCode.LOCAL_SIGNIN_REQUIRES_2FA: {
            // Store temp token for 2FA verification
            if (callbackData.tempToken) {
              setTempToken(callbackData.tempToken);
            }

            options.onTwoFactorRequired?.({
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

            options.onTwoFactorRequired?.({
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
            options.onError?.({
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Auth callback failed';
        setError(message);
        console.error('Auth callback error:', error);
      }
    },
    [executeCallback, setError],
  );

  return { error, handleAuthCallback };
};
