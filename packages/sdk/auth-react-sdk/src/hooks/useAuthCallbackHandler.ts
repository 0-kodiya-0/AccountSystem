import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { OAuthProviders } from '../types';

// New callback codes enum - Updated with logout codes
export enum CallbackCode {
  // OAuth success codes
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',

  // Local auth success codes
  LOCAL_SIGNIN_SUCCESS = 'local_signin_success',
  LOCAL_SIGNUP_SUCCESS = 'local_signup_success',
  LOCAL_2FA_REQUIRED = 'local_2fa_required',
  LOCAL_EMAIL_VERIFIED = 'local_email_verified',
  LOCAL_PASSWORD_RESET_SUCCESS = 'local_password_reset_success',

  // Logout success codes
  LOGOUT_SUCCESS = 'logout_success',
  LOGOUT_DISABLE_SUCCESS = 'logout_disable_success',
  LOGOUT_ALL_SUCCESS = 'logout_all_success',

  // Error codes
  OAUTH_ERROR = 'oauth_error',
  LOCAL_AUTH_ERROR = 'local_auth_error',
  PERMISSION_ERROR = 'permission_error',
  USER_NOT_FOUND = 'user_not_found',
}

export interface CallbackData {
  code: CallbackCode;
  accountId?: string;
  accountIds?: string[];
  name?: string;
  provider?: OAuthProviders;
  tempToken?: string;
  service?: string;
  scopeLevel?: string;
  error?: string;
  message?: string;
  clearClientAccountState?: boolean;
  needsAdditionalScopes?: boolean;
  // Additional context data
  [key: string]: any;
}

type CallbackHandler<T = any> = (data: T) => void | Promise<void>;

interface UseCallbackHandlerOptions {
  onOAuthSigninSuccess?: CallbackHandler<{
    accountId: string;
    name: string;
    provider: OAuthProviders;
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
  }>;
  onLocalSigninSuccess?: CallbackHandler<{
    accountId: string;
    name: string;
  }>;
  onLocalSignupSuccess?: CallbackHandler<{
    accountId: string;
    message?: string;
  }>;
  onLocal2FARequired?: CallbackHandler<{
    tempToken: string;
    accountId: string;
    message?: string;
  }>;
  onLocalEmailVerified?: CallbackHandler<{ message?: string }>;
  onLocalPasswordResetSuccess?: CallbackHandler<{ message?: string }>;
  onLogoutSuccess?: CallbackHandler<{ accountId: string; message?: string }>;
  onLogoutAllSuccess?: CallbackHandler<{
    accountIds: string[];
    message?: string;
  }>;
  onError?: CallbackHandler<{
    error: string;
    provider?: OAuthProviders;
    code?: string;
  }>;
}

interface UseCallbackHandlerReturn {
  error: string | null;
  handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useAuthCallbackHandler = (options: UseCallbackHandlerOptions = {}): UseCallbackHandlerReturn => {
  const { setTempToken, refreshSession } = useAuth();
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
            });
            break;
          }

          case CallbackCode.LOCAL_SIGNIN_SUCCESS: {
            await refreshSession();
            options.onLocalSigninSuccess?.({
              accountId: callbackData.accountId!,
              name: callbackData.name!,
            });
            break;
          }

          case CallbackCode.LOCAL_SIGNUP_SUCCESS: {
            options.onLocalSignupSuccess?.({
              accountId: callbackData.accountId!,
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOCAL_2FA_REQUIRED: {
            setTempToken(callbackData.tempToken!);
            options.onLocal2FARequired?.({
              tempToken: callbackData.tempToken!,
              accountId: callbackData.accountId!,
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOCAL_EMAIL_VERIFIED: {
            options.onLocalEmailVerified?.({
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOCAL_PASSWORD_RESET_SUCCESS: {
            options.onLocalPasswordResetSuccess?.({
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOGOUT_SUCCESS: {
            await refreshSession();
            options.onLogoutSuccess?.({
              accountId: callbackData.accountId!,
              message: callbackData.message,
            });
            break;
          }

          case CallbackCode.LOGOUT_ALL_SUCCESS: {
            await refreshSession();
            options.onLogoutAllSuccess?.({
              accountIds: callbackData.accountIds!,
              message: callbackData.message,
            });
            break;
          }

          default: {
            options.onError?.({
              error: callbackData.error || 'Unknown callback error',
              provider: callbackData.provider,
              code: callbackData.code,
            });
            break;
          }
        }

        // Navigate to root if no custom handler provided
        if (!options[`on${callbackData.code}` as keyof typeof options]) {
          navigateToRoot();
        }
      } catch (error) {
        console.error('Error handling callback:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown callback handling error';
        setError(errorMessage);
        navigateToRoot();
      }
    },
    [options, setTempToken, refreshSession, navigateToRoot],
  );

  const handleAuthCallback = useCallback(
    async (params: URLSearchParams) => {
      try {
        const code = params.get('code');
        if (!code) {
          throw new Error('No callback code found');
        }

        const callbackData: CallbackData = { code: code as CallbackCode };

        // Parse other parameters
        for (const [key, value] of params.entries()) {
          if (key !== 'code') {
            if (key === 'accountIds') {
              callbackData[key] = value.split(',');
            } else if (key === 'clearClientAccountState') {
              callbackData[key] = value === 'true';
            } else {
              callbackData[key] = value;
            }
          }
        }

        await executeCallback(callbackData);

        // Clean up URL parameters
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
