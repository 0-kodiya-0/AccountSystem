import { useCallback, useState } from 'react';
import { CallbackCode, CallbackData, OAuthProviders, Account } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useServices } from './core/useServices';
import { useAuthStore } from '../store/authStore';

// Handler that receives data and optional default implementation
type HandlerWithDefault<T> = (
  data: T,
  defaultHandler: () => Promise<void>,
) => void | Promise<void>;

interface UseCallbackHandlerOptions {
  // Complete override handlers - if provided, default won't run unless called
  onOAuthSigninSuccess?: HandlerWithDefault<{
    accountId: string;
    name: string;
    provider: OAuthProviders;
    account?: Account;
  }>;
  onOAuthSignupSuccess?: HandlerWithDefault<{
    accountId: string;
    name: string;
    provider: OAuthProviders;
    account?: Account;
  }>;
  onOAuthPermissionSuccess?: HandlerWithDefault<{
    accountId: string;
    service?: string;
    scopeLevel?: string;
    provider: OAuthProviders;
  }>;

  onLocalSigninSuccess?: HandlerWithDefault<{
    accountId: string;
    name: string;
    account?: Account;
  }>;
  onLocalSignupSuccess?: HandlerWithDefault<{
    accountId: string;
    message?: string;
  }>;
  onLocal2FARequired?: HandlerWithDefault<{
    tempToken: string;
    accountId: string;
    message?: string;
  }>;
  onLocalEmailVerified?: HandlerWithDefault<{ message?: string }>;
  onLocalPasswordResetSuccess?: HandlerWithDefault<{ message?: string }>;

  onLogoutSuccess?: HandlerWithDefault<{ accountId: string; message?: string }>;
  onLogoutAllSuccess?: HandlerWithDefault<{
    accountIds: string[];
    message?: string;
  }>;

  // Error handlers
  onOAuthError?: HandlerWithDefault<{
    error: string;
    provider?: OAuthProviders;
    code?: string;
  }>;
  onLocalAuthError?: HandlerWithDefault<{ error: string; code?: string }>;
  onPermissionError?: HandlerWithDefault<{
    error: string;
    provider?: OAuthProviders;
    code?: string;
  }>;
  onUserNotFound?: HandlerWithDefault<{ error: string }>;
  onUserExists?: HandlerWithDefault<{ error: string }>;
  onTokenExpired?: HandlerWithDefault<{ error: string }>;

  // Special cases
  onPermissionReauthorize?: HandlerWithDefault<{
    accountId: string;
    missingScopes?: string[];
  }>;
  onUnknownCode?: HandlerWithDefault<CallbackData>;
}

interface UseCallbackHandlerReturn {
  error: string | null;
  handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useAuthCallbackHandler = (
  options: UseCallbackHandlerOptions = {},
): UseCallbackHandlerReturn => {
  const { googleService } = useServices();
  const { setTempToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  // Simple navigation helper
  const navigateToRoot = useCallback(() => {
    window.location.href = '/';
  }, []);

  // Create default handlers
  const defaultOAuthSigninSuccess = useCallback(
    async (data: {
      accountId: string;
      name: string;
      provider: OAuthProviders;
    }) => {
      console.log(
        `OAuth signin successful: ${data.name} (${data.accountId}) via ${data.provider}`,
      );
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultOAuthSignupSuccess = useCallback(
    async (data: {
      accountId: string;
      name: string;
      provider: OAuthProviders;
    }) => {
      console.log(
        `OAuth signup successful: ${data.name} (${data.accountId}) via ${data.provider}`,
      );
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultOAuthPermissionSuccess = useCallback(
    async (data: {
      accountId: string;
      service?: string;
      scopeLevel?: string;
      provider: OAuthProviders;
    }) => {
      console.log(
        `OAuth permission granted: ${data.service} ${data.scopeLevel} for ${data.accountId} via ${data.provider}`,
      );
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLocalSigninSuccess = useCallback(
    async (data: { accountId: string; name: string }) => {
      console.log(`Local signin successful: ${data.name} (${data.accountId})`);
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLocalSignupSuccess = useCallback(
    async (data: { accountId: string; message?: string }) => {
      console.log(
        `Local signup successful: ${data.accountId} - ${data.message}`,
      );
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLocal2FARequired = useCallback(
    async (data: {
      tempToken: string;
      accountId: string;
      message?: string;
    }) => {
      console.log(`2FA required for ${data.accountId}: ${data.message}`);
      setTempToken(data.tempToken);
      navigateToRoot();
    },
    [setTempToken, navigateToRoot],
  );

  const defaultLocalEmailVerified = useCallback(
    async (data: { message?: string }) => {
      console.log(`Email verified: ${data.message}`);
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLocalPasswordResetSuccess = useCallback(
    async (data: { message?: string }) => {
      console.log(`Password reset successful: ${data.message}`);
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLogoutSuccess = useCallback(
    async (data: { accountId: string; message?: string }) => {
      console.log(`Account logged out: ${data.accountId} - ${data.message}`);
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultLogoutAllSuccess = useCallback(
    async (data: { accountIds: string[]; message?: string }) => {
      console.log(
        `All accounts logged out: ${data.accountIds.join(', ')} - ${data.message}`,
      );
      navigateToRoot();
    },
    [navigateToRoot],
  );

  const defaultOAuthError = useCallback(
    async (data: { error: string; provider?: OAuthProviders }) => {
      console.error(`OAuth error (${data.provider}): ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultLocalAuthError = useCallback(
    async (data: { error: string }) => {
      console.error(`Local auth error: ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultPermissionError = useCallback(
    async (data: { error: string; provider?: OAuthProviders }) => {
      console.error(`Permission error (${data.provider}): ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultUserNotFound = useCallback(
    async (data: { error: string }) => {
      console.error(`User not found: ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultUserExists = useCallback(
    async (data: { error: string }) => {
      console.error(`User exists: ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultTokenExpired = useCallback(
    async (data: { error: string }) => {
      console.error(`Token expired: ${data.error}`);
      setError(data.error);
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  const defaultPermissionReauthorize = useCallback(
    async (data: { accountId: string }) => {
      console.log(
        `Permission reauthorization needed for account ${data.accountId}`,
      );
      googleService.reauthorizePermissions(data.accountId);
    },
    [googleService],
  );

  const defaultUnknownCode = useCallback(
    async (data: CallbackData) => {
      console.warn('Unknown callback code:', data);
      setError('Unknown callback response');
      navigateToRoot();
    },
    [setError, navigateToRoot],
  );

  // Simple execution logic - override OR default, not both
  const executeCallbackHandler = useCallback(
    async (callbackData: CallbackData): Promise<void> => {
      try {
        switch (callbackData.code) {
          case CallbackCode.OAUTH_SIGNIN_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              name: callbackData.name!,
              provider: callbackData.provider!,
            };

            if (options.onOAuthSigninSuccess) {
              // Override provided - call it with default that has data pre-bound
              await options.onOAuthSigninSuccess(data, () =>
                defaultOAuthSigninSuccess(data),
              );
            } else {
              // No override - call default
              await defaultOAuthSigninSuccess(data);
            }
            break;
          }

          case CallbackCode.OAUTH_SIGNUP_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              name: callbackData.name!,
              provider: callbackData.provider!,
            };

            if (options.onOAuthSignupSuccess) {
              await options.onOAuthSignupSuccess(data, () =>
                defaultOAuthSignupSuccess(data),
              );
            } else {
              await defaultOAuthSignupSuccess(data);
            }
            break;
          }

          case CallbackCode.OAUTH_PERMISSION_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              service: callbackData.service,
              scopeLevel: callbackData.scopeLevel,
              provider: callbackData.provider!,
            };

            if (options.onOAuthPermissionSuccess) {
              await options.onOAuthPermissionSuccess(data, () =>
                defaultOAuthPermissionSuccess(data),
              );
            } else {
              await defaultOAuthPermissionSuccess(data);
            }
            break;
          }

          case CallbackCode.LOCAL_SIGNIN_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              name: callbackData.name!,
            };

            if (options.onLocalSigninSuccess) {
              await options.onLocalSigninSuccess(data, () =>
                defaultLocalSigninSuccess(data),
              );
            } else {
              await defaultLocalSigninSuccess(data);
            }
            break;
          }

          case CallbackCode.LOCAL_SIGNUP_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              message: callbackData.message,
            };

            if (options.onLocalSignupSuccess) {
              await options.onLocalSignupSuccess(data, () =>
                defaultLocalSignupSuccess(data),
              );
            } else {
              await defaultLocalSignupSuccess(data);
            }
            break;
          }

          case CallbackCode.LOCAL_2FA_REQUIRED: {
            const data = {
              tempToken: callbackData.tempToken!,
              accountId: callbackData.accountId!,
              message: callbackData.message,
            };

            if (options.onLocal2FARequired) {
              await options.onLocal2FARequired(data, () =>
                defaultLocal2FARequired(data),
              );
            } else {
              await defaultLocal2FARequired(data);
            }
            break;
          }

          case CallbackCode.LOCAL_EMAIL_VERIFIED: {
            const data = { message: callbackData.message };

            if (options.onLocalEmailVerified) {
              await options.onLocalEmailVerified(data, () =>
                defaultLocalEmailVerified(data),
              );
            } else {
              await defaultLocalEmailVerified(data);
            }
            break;
          }

          case CallbackCode.LOCAL_PASSWORD_RESET_SUCCESS: {
            const data = { message: callbackData.message };

            if (options.onLocalPasswordResetSuccess) {
              await options.onLocalPasswordResetSuccess(data, () =>
                defaultLocalPasswordResetSuccess(data),
              );
            } else {
              await defaultLocalPasswordResetSuccess(data);
            }
            break;
          }

          case CallbackCode.LOGOUT_SUCCESS: {
            const data = {
              accountId: callbackData.accountId!,
              message: callbackData.message,
            };

            if (options.onLogoutSuccess) {
              await options.onLogoutSuccess(data, () =>
                defaultLogoutSuccess(data),
              );
            } else {
              await defaultLogoutSuccess(data);
            }
            break;
          }

          case CallbackCode.LOGOUT_ALL_SUCCESS: {
            const data = {
              accountIds: callbackData.accountIds!,
              message: callbackData.message,
            };

            if (options.onLogoutAllSuccess) {
              await options.onLogoutAllSuccess(data, () =>
                defaultLogoutAllSuccess(data),
              );
            } else {
              await defaultLogoutAllSuccess(data);
            }
            break;
          }

          case CallbackCode.OAUTH_ERROR: {
            const data = {
              error: callbackData.error || 'OAuth authentication failed',
              provider: callbackData.provider,
              code: callbackData.code,
            };

            if (options.onOAuthError) {
              await options.onOAuthError(data, () => defaultOAuthError(data));
            } else {
              await defaultOAuthError(data);
            }
            break;
          }

          case CallbackCode.LOCAL_AUTH_ERROR: {
            const data = {
              error: callbackData.error || 'Local authentication failed',
              code: callbackData.code,
            };

            if (options.onLocalAuthError) {
              await options.onLocalAuthError(data, () =>
                defaultLocalAuthError(data),
              );
            } else {
              await defaultLocalAuthError(data);
            }
            break;
          }

          case CallbackCode.PERMISSION_ERROR: {
            const data = {
              error: callbackData.error || 'Permission request failed',
              provider: callbackData.provider,
              code: callbackData.code,
            };

            if (options.onPermissionError) {
              await options.onPermissionError(data, () =>
                defaultPermissionError(data),
              );
            } else {
              await defaultPermissionError(data);
            }
            break;
          }

          case CallbackCode.USER_NOT_FOUND: {
            const data = { error: callbackData.error || 'User not found' };

            if (options.onUserNotFound) {
              await options.onUserNotFound(data, () =>
                defaultUserNotFound(data),
              );
            } else {
              await defaultUserNotFound(data);
            }
            break;
          }

          case CallbackCode.USER_EXISTS: {
            const data = { error: callbackData.error || 'User already exists' };

            if (options.onUserExists) {
              await options.onUserExists(data, () => defaultUserExists(data));
            } else {
              await defaultUserExists(data);
            }
            break;
          }

          case CallbackCode.TOKEN_EXPIRED: {
            const data = { error: callbackData.error || 'Token expired' };

            if (options.onTokenExpired) {
              await options.onTokenExpired(data, () =>
                defaultTokenExpired(data),
              );
            } else {
              await defaultTokenExpired(data);
            }
            break;
          }

          case CallbackCode.PERMISSION_REAUTHORIZE: {
            const data = {
              accountId: callbackData.accountId!,
              missingScopes: callbackData.missingScopes,
            };

            if (options.onPermissionReauthorize) {
              await options.onPermissionReauthorize(data, () =>
                defaultPermissionReauthorize(data),
              );
            } else {
              await defaultPermissionReauthorize(data);
            }
            break;
          }

          default: {
            if (options.onUnknownCode) {
              await options.onUnknownCode(callbackData, () =>
                defaultUnknownCode(callbackData),
              );
            } else {
              await defaultUnknownCode(callbackData);
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error handling callback:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown callback handling error';
        setError(errorMessage);
        navigateToRoot();
      }
    },
    [
      options,
      defaultOAuthSigninSuccess,
      defaultOAuthSignupSuccess,
      defaultOAuthPermissionSuccess,
      defaultLocalSigninSuccess,
      defaultLocalSignupSuccess,
      defaultLocal2FARequired,
      defaultLocalEmailVerified,
      defaultLocalPasswordResetSuccess,
      defaultLogoutSuccess,
      defaultLogoutAllSuccess,
      defaultOAuthError,
      defaultLocalAuthError,
      defaultPermissionError,
      defaultUserNotFound,
      defaultUserExists,
      defaultTokenExpired,
      defaultPermissionReauthorize,
      defaultUnknownCode,
      setError,
      navigateToRoot,
    ],
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

        await executeCallbackHandler(callbackData);

        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Auth callback failed';
        setError(message);
        console.error('Auth callback error:', error);
      }
    },
    [executeCallbackHandler, setError],
  );

  return { error, handleAuthCallback };
};
