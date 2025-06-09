import { useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { CallbackCode, CallbackData, OAuthProviders, Account } from '../types';

interface UseCallbackHandlerOptions {
    // OAuth success handlers
    onOAuthSigninSuccess?: (data: { accountId: string; name: string; provider: OAuthProviders; account?: Account }) => void | Promise<void>;
    onOAuthSignupSuccess?: (data: { accountId: string; name: string; provider: OAuthProviders; account?: Account }) => void | Promise<void>;
    onOAuthPermissionSuccess?: (data: { accountId: string; service?: string; scopeLevel?: string; provider: OAuthProviders }) => void | Promise<void>;

    // Local auth success handlers
    onLocalSigninSuccess?: (data: { accountId: string; name: string; account?: Account }) => void | Promise<void>;
    onLocalSignupSuccess?: (data: { accountId: string; message?: string }) => void | Promise<void>;
    onLocal2FARequired?: (data: { tempToken: string; accountId: string; message?: string }) => void | Promise<void>;
    onLocalEmailVerified?: (data: { message?: string }) => void | Promise<void>;
    onLocalPasswordResetSuccess?: (data: { message?: string }) => void | Promise<void>;

    // Logout success handlers
    onLogoutSuccess?: (data: { accountId: string; message?: string }) => void | Promise<void>;
    onLogoutDisableSuccess?: (data: { accountId: string; message?: string }) => void | Promise<void>;
    onLogoutAllSuccess?: (data: { accountIds: string[]; message?: string }) => void | Promise<void>;

    // Error handlers
    onOAuthError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void | Promise<void>;
    onLocalAuthError?: (data: { error: string; code?: string }) => void | Promise<void>;
    onPermissionError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void | Promise<void>;
    onUserNotFound?: (data: { error: string }) => void | Promise<void>;
    onUserExists?: (data: { error: string }) => void | Promise<void>;
    onTokenExpired?: (data: { error: string }) => void | Promise<void>;

    // Special flow handlers
    onPermissionReauthorize?: (data: { accountId: string; missingScopes?: string[] }) => void | Promise<void>;

    // Generic handlers
    onSuccess?: (data: CallbackData) => void | Promise<void>;
    onError?: (data: CallbackData) => void | Promise<void>;
    onUnknownCode?: (data: CallbackData) => void | Promise<void>;

    // Control default behavior after override handlers
    disableDefaultHandlers?: boolean;
}

interface UseCallbackHandlerReturn {
    handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useAuthCallbackHandler = (options: UseCallbackHandlerOptions = {}): UseCallbackHandlerReturn => {
    const {
        client,
        addAccount,
        setCurrentAccount,
        setOAuthTempToken,
        clearOAuthState,
        setAuthenticating,
        setError,
        clearError,
        removeAccount,
        disableAccount
    } = useAuth();

    const {
        disableDefaultHandlers = false,
        ...overrideHandlers
    } = options;

    // Simple navigation helper - always redirects to root
    const navigateToRoot = useCallback(() => {
        window.location.href = '/';
    }, []);

    // URL parameter decoder
    const decodeParam = useCallback((value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch (error) {
            console.warn('Failed to decode parameter:', value, error);
            return value;
        }
    }, []);

    // Handler execution logic
    const executeHandler = useCallback(async (
        callbackData: CallbackData
    ): Promise<void> => {
        try {
            switch (callbackData.code) {
                // OAuth success cases
                case CallbackCode.OAUTH_SIGNIN_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onOAuthSigninSuccess) {
                        await overrideHandlers.onOAuthSigninSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`OAuth signin successful: ${data.name} (${data.accountId}) via ${data.provider}`);

                        const account = await client.getAccount(data.accountId);
                        addAccount(account);
                        setCurrentAccount(data.accountId);
                        clearOAuthState();

                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.OAUTH_SIGNUP_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onOAuthSignupSuccess) {
                        await overrideHandlers.onOAuthSignupSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`OAuth signup successful: ${data.name} (${data.accountId}) via ${data.provider}`);

                        const account = await client.getAccount(data.accountId);
                        addAccount(account);
                        setCurrentAccount(data.accountId);
                        clearOAuthState();

                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.OAUTH_PERMISSION_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        service: callbackData.service,
                        scopeLevel: callbackData.scopeLevel,
                        provider: callbackData.provider!
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onOAuthPermissionSuccess) {
                        await overrideHandlers.onOAuthPermissionSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`OAuth permission granted: ${data.service} ${data.scopeLevel} for ${data.accountId} via ${data.provider}`);
                        navigateToRoot();
                    }
                    break;
                }

                // Local auth success cases
                case CallbackCode.LOCAL_SIGNIN_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocalSigninSuccess) {
                        await overrideHandlers.onLocalSigninSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Local signin successful: ${data.name} (${data.accountId})`);

                        const account = await client.getAccount(data.accountId);
                        addAccount(account);
                        setCurrentAccount(data.accountId);

                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOCAL_SIGNUP_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocalSignupSuccess) {
                        await overrideHandlers.onLocalSignupSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Local signup successful: ${data.accountId} - ${data.message}`);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOCAL_2FA_REQUIRED: {
                    const data = {
                        tempToken: callbackData.tempToken!,
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocal2FARequired) {
                        await overrideHandlers.onLocal2FARequired(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`2FA required for ${data.accountId}: ${data.message}`);
                        setOAuthTempToken(data.tempToken);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOCAL_EMAIL_VERIFIED: {
                    const data = { message: callbackData.message };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocalEmailVerified) {
                        await overrideHandlers.onLocalEmailVerified(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Email verified: ${data.message}`);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOCAL_PASSWORD_RESET_SUCCESS: {
                    const data = { message: callbackData.message };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocalPasswordResetSuccess) {
                        await overrideHandlers.onLocalPasswordResetSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Password reset successful: ${data.message}`);
                        navigateToRoot();
                    }
                    break;
                }

                // Logout success cases
                case CallbackCode.LOGOUT_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLogoutSuccess) {
                        await overrideHandlers.onLogoutSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Account logged out: ${data.accountId} - ${data.message}`);
                        removeAccount(data.accountId);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOGOUT_DISABLE_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLogoutDisableSuccess) {
                        await overrideHandlers.onLogoutDisableSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Account logged out and disabled: ${data.accountId} - ${data.message}`);
                        disableAccount(data.accountId);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOGOUT_ALL_SUCCESS: {
                    const data = {
                        accountIds: callbackData.accountIds!,
                        message: callbackData.message
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLogoutAllSuccess) {
                        await overrideHandlers.onLogoutAllSuccess(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`All accounts logged out: ${data.accountIds.join(', ')} - ${data.message}`);
                        // Remove all specified accounts
                        data.accountIds.forEach(accountId => removeAccount(accountId));
                        navigateToRoot();
                    }
                    break;
                }

                // Error cases - all redirect to root with error in URL
                case CallbackCode.OAUTH_ERROR: {
                    const data = {
                        error: callbackData.error || 'OAuth authentication failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onOAuthError) {
                        await overrideHandlers.onOAuthError(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`OAuth error (${data.provider}): ${data.error} [${data.code}]`);
                        setError(data.error);
                        clearOAuthState();
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.LOCAL_AUTH_ERROR: {
                    const data = {
                        error: callbackData.error || 'Local authentication failed',
                        code: callbackData.code
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onLocalAuthError) {
                        await overrideHandlers.onLocalAuthError(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`Local auth error: ${data.error} [${data.code}]`);
                        setError(data.error);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.PERMISSION_ERROR: {
                    const data = {
                        error: callbackData.error || 'Permission request failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onPermissionError) {
                        await overrideHandlers.onPermissionError(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`Permission error (${data.provider}): ${data.error} [${data.code}]`);
                        setError(data.error);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.USER_NOT_FOUND: {
                    const data = { error: callbackData.error || 'User not found' };

                    // Always run override handler first if provided
                    if (overrideHandlers.onUserNotFound) {
                        await overrideHandlers.onUserNotFound(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`User not found: ${data.error}`);
                        setError(data.error);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.USER_EXISTS: {
                    const data = { error: callbackData.error || 'User already exists' };

                    // Always run override handler first if provided
                    if (overrideHandlers.onUserExists) {
                        await overrideHandlers.onUserExists(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`User exists: ${data.error}`);
                        setError(data.error);
                        navigateToRoot();
                    }
                    break;
                }

                case CallbackCode.TOKEN_EXPIRED: {
                    const data = { error: callbackData.error || 'Token expired' };

                    // Always run override handler first if provided
                    if (overrideHandlers.onTokenExpired) {
                        await overrideHandlers.onTokenExpired(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.error(`Token expired: ${data.error}`);
                        setError(data.error);
                        clearOAuthState();
                        navigateToRoot();
                    }
                    break;
                }

                // Special flow cases
                case CallbackCode.PERMISSION_REAUTHORIZE: {
                    const data = {
                        accountId: callbackData.accountId!,
                        missingScopes: callbackData.missingScopes
                    };

                    // Always run override handler first if provided
                    if (overrideHandlers.onPermissionReauthorize) {
                        await overrideHandlers.onPermissionReauthorize(data);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Permission reauthorization needed for account ${data.accountId}`);
                        
                        // User is successfully signed in, so save their information
                        const account = await client.getAccount(data.accountId);
                        addAccount(account);
                        setCurrentAccount(data.accountId);
                        clearOAuthState();
                        
                        // Now request the missing permissions
                        client.reauthorizePermissions(data.accountId);
                    }
                    break;
                }

                // Unknown code
                default: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onUnknownCode) {
                        await overrideHandlers.onUnknownCode(callbackData);
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.warn('Unknown callback code:', callbackData);
                        setError('Unknown callback response');
                        navigateToRoot();
                    }
                    break;
                }
            }

            // Execute success handler if provided
            if (overrideHandlers.onSuccess) {
                await overrideHandlers.onSuccess(callbackData);
            }

        } catch (error) {
            console.error('Error handling callback:', error);

            const errorData = {
                ...callbackData,
                error: error instanceof Error ? error.message : 'Unknown callback handling error'
            };

            if (overrideHandlers.onError) {
                await overrideHandlers.onError(errorData);
            }

            // Run default error handling unless disabled
            if (!disableDefaultHandlers) {
                setError(errorData.error);
                navigateToRoot();
            }
        }
    }, [
        client, addAccount, setCurrentAccount, setOAuthTempToken, clearOAuthState,
        setError, disableDefaultHandlers, overrideHandlers, navigateToRoot
    ]);

    const handleAuthCallback = useCallback(async (params: URLSearchParams) => {
        try {
            setAuthenticating(true);
            clearError();

            const code = params.get('code');

            if (!code) {
                throw new Error('No callback code found');
            }

            const callbackData: CallbackData = {
                code: decodeParam(code) as CallbackCode
            };

            // Parse all other parameters and decode them
            for (const [key, value] of params.entries()) {
                if (key !== 'code') {
                    if (key === 'accountIds') {
                        // Handle array parameters
                        callbackData[key] = decodeParam(value).split(',');
                    } else if (key === 'clearClientAccountState') {
                        // Handle boolean parameters
                        callbackData[key] = decodeParam(value) === 'true';
                    } else {
                        callbackData[key] = decodeParam(value);
                    }
                }
            }

            await executeHandler(callbackData);

            // Clean up URL parameters
            const url = new URL(window.location.href);
            url.search = '';
            window.history.replaceState({}, '', url.toString());

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Auth callback failed';
            setError(message);
            console.error('Auth callback error:', error);
        } finally {
            setAuthenticating(false);
        }
    }, [executeHandler, setAuthenticating, setError, clearError, decodeParam]);

    return {
        handleAuthCallback
    };
};