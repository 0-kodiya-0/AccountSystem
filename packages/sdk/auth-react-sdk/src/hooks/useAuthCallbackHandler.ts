import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { OAuthProviders } from '../types';

// Callback codes based on actual backend implementation
export enum CallbackCode {
  // OAuth success codes
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',

  // Error codes
  OAUTH_ERROR = 'oauth_error',
  PERMISSION_ERROR = 'permission_error',
}

export interface CallbackData {
  code: CallbackCode;
  accountId?: string;
  name?: string;
  provider?: OAuthProviders;
  service?: string;
  scopeLevel?: string;
  error?: string;
  message?: string;
  needsAdditionalScopes?: boolean;
  missingScopes?: string[];
  // Additional context data
  [key: string]: any;
}

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
  onError?: CallbackHandler<{
    error: string;
    provider?: OAuthProviders;
    code: CallbackCode;
  }>;
}

interface UseCallbackHandlerReturn {
  error: string | null;
  handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useAuthCallbackHandler = (options: UseCallbackHandlerOptions = {}): UseCallbackHandlerReturn => {
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
    [options, refreshSession, navigateToRoot],
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
            if (key === 'missingScopes') {
              // Handle comma-separated missing scopes
              callbackData[key] = value ? value.split(',').map((s) => s.trim()) : [];
            } else if (key === 'needsAdditionalScopes') {
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
