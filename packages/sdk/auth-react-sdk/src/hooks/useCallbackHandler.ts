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
    
    // Error handlers
    onOAuthError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void | Promise<void>;
    onLocalAuthError?: (data: { error: string; code?: string }) => void | Promise<void>;
    onPermissionError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void | Promise<void>;
    onInvalidState?: (data: { error: string }) => void | Promise<void>;
    onUserNotFound?: (data: { error: string }) => void | Promise<void>;
    onUserExists?: (data: { error: string }) => void | Promise<void>;
    onTokenExpired?: (data: { error: string }) => void | Promise<void>;
    
    // Special flow handlers
    onPermissionReauthorize?: (data: { accountId: string; name: string; provider: OAuthProviders }) => void | Promise<void>;
    onAccountSelectionRequired?: (data: { accounts?: string[] }) => void | Promise<void>;
    
    // Generic handlers
    onSuccess?: (data: CallbackData) => void | Promise<void>;
    onError?: (data: CallbackData) => void | Promise<void>;
    onUnknownCode?: (data: CallbackData) => void | Promise<void>;

    // Navigation/redirect options
    enableAutoRedirect?: boolean;
    customRedirectUrl?: string;
}

interface UseCallbackHandlerReturn {
    handleAuthCallback: (params: URLSearchParams) => Promise<void>;
}

export const useCallbackHandler = (options: UseCallbackHandlerOptions = {}): UseCallbackHandlerReturn => {
    const {
        client,
        addAccount,
        setCurrentAccount,
        setOAuthTempToken,
        clearOAuthState,
        setAuthenticating,
        setError,
        clearError
    } = useAuth();

    const {
        enableAutoRedirect = true,
        customRedirectUrl,
        ...overrideHandlers
    } = options;

    // Default navigation helper
    const navigateTo = useCallback((url: string, delay: number = 0) => {
        if (delay > 0) {
            setTimeout(() => {
                window.location.href = url;
            }, delay);
        } else {
            window.location.href = url;
        }
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
        const defaultRedirectUrl = customRedirectUrl || window.location.origin + '/dashboard';

        try {
            switch (callbackData.code) {
                // OAuth success cases
                case CallbackCode.OAUTH_SIGNIN_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    };

                    if (overrideHandlers.onOAuthSigninSuccess) {
                        await overrideHandlers.onOAuthSigninSuccess(data);
                        break;
                    }

                    console.log(`OAuth signin successful: ${data.name} (${data.accountId}) via ${data.provider}`);
                    
                    const account = await client.getAccount(data.accountId);
                    addAccount(account);
                    setCurrentAccount(data.accountId);
                    clearOAuthState();
                    
                    if (enableAutoRedirect) {
                        navigateTo(defaultRedirectUrl);
                    }
                    break;
                }

                case CallbackCode.OAUTH_SIGNUP_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    };

                    if (overrideHandlers.onOAuthSignupSuccess) {
                        await overrideHandlers.onOAuthSignupSuccess(data);
                        break;
                    }

                    console.log(`OAuth signup successful: ${data.name} (${data.accountId}) via ${data.provider}`);
                    
                    const account = await client.getAccount(data.accountId);
                    addAccount(account);
                    setCurrentAccount(data.accountId);
                    clearOAuthState();
                    
                    if (enableAutoRedirect) {
                        navigateTo(defaultRedirectUrl);
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

                    if (overrideHandlers.onOAuthPermissionSuccess) {
                        await overrideHandlers.onOAuthPermissionSuccess(data);
                        break;
                    }

                    console.log(`OAuth permission granted: ${data.service} ${data.scopeLevel} for ${data.accountId} via ${data.provider}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(defaultRedirectUrl);
                    }
                    break;
                }

                // Local auth success cases
                case CallbackCode.LOCAL_SIGNIN_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!
                    };

                    if (overrideHandlers.onLocalSigninSuccess) {
                        await overrideHandlers.onLocalSigninSuccess(data);
                        break;
                    }

                    console.log(`Local signin successful: ${data.name} (${data.accountId})`);
                    
                    const account = await client.getAccount(data.accountId);
                    addAccount(account);
                    setCurrentAccount(data.accountId);
                    
                    if (enableAutoRedirect) {
                        navigateTo(defaultRedirectUrl);
                    }
                    break;
                }

                case CallbackCode.LOCAL_SIGNUP_SUCCESS: {
                    const data = {
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    if (overrideHandlers.onLocalSignupSuccess) {
                        await overrideHandlers.onLocalSignupSuccess(data);
                        break;
                    }

                    console.log(`Local signup successful: ${data.accountId} - ${data.message}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/check-email');
                    }
                    break;
                }

                case CallbackCode.LOCAL_2FA_REQUIRED: {
                    const data = {
                        tempToken: callbackData.tempToken!,
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    };

                    if (overrideHandlers.onLocal2FARequired) {
                        await overrideHandlers.onLocal2FARequired(data);
                        break;
                    }

                    console.log(`2FA required for ${data.accountId}: ${data.message}`);
                    setOAuthTempToken(data.tempToken);
                    
                    if (enableAutoRedirect) {
                        navigateTo(`${window.location.origin}/two-factor-verify?tempToken=${data.tempToken}`);
                    }
                    break;
                }

                case CallbackCode.LOCAL_EMAIL_VERIFIED: {
                    const data = { message: callbackData.message };

                    if (overrideHandlers.onLocalEmailVerified) {
                        await overrideHandlers.onLocalEmailVerified(data);
                        break;
                    }

                    console.log(`Email verified: ${data.message}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
                    }
                    break;
                }

                case CallbackCode.LOCAL_PASSWORD_RESET_SUCCESS: {
                    const data = { message: callbackData.message };

                    if (overrideHandlers.onLocalPasswordResetSuccess) {
                        await overrideHandlers.onLocalPasswordResetSuccess(data);
                        break;
                    }

                    console.log(`Password reset successful: ${data.message}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
                    }
                    break;
                }

                // Error cases
                case CallbackCode.OAUTH_ERROR: {
                    const data = {
                        error: callbackData.error || 'OAuth authentication failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    };

                    if (overrideHandlers.onOAuthError) {
                        await overrideHandlers.onOAuthError(data);
                        break;
                    }

                    console.error(`OAuth error (${data.provider}): ${data.error} [${data.code}]`);
                    setError(data.error);
                    clearOAuthState();
                    
                    if (enableAutoRedirect) {
                        const loginUrl = new URL(window.location.origin + '/login');
                        loginUrl.searchParams.set('error', data.error);
                        navigateTo(loginUrl.toString());
                    }
                    break;
                }

                case CallbackCode.LOCAL_AUTH_ERROR: {
                    const data = {
                        error: callbackData.error || 'Local authentication failed',
                        code: callbackData.code
                    };

                    if (overrideHandlers.onLocalAuthError) {
                        await overrideHandlers.onLocalAuthError(data);
                        break;
                    }

                    console.error(`Local auth error: ${data.error} [${data.code}]`);
                    setError(data.error);
                    
                    if (enableAutoRedirect) {
                        const loginUrl = new URL(window.location.origin + '/login');
                        loginUrl.searchParams.set('error', data.error);
                        navigateTo(loginUrl.toString());
                    }
                    break;
                }

                case CallbackCode.PERMISSION_ERROR: {
                    const data = {
                        error: callbackData.error || 'Permission request failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    };

                    if (overrideHandlers.onPermissionError) {
                        await overrideHandlers.onPermissionError(data);
                        break;
                    }

                    console.error(`Permission error (${data.provider}): ${data.error} [${data.code}]`);
                    setError(data.error);
                    
                    if (enableAutoRedirect) {
                        const dashboardUrl = new URL(defaultRedirectUrl);
                        dashboardUrl.searchParams.set('error', data.error);
                        navigateTo(dashboardUrl.toString());
                    }
                    break;
                }

                case CallbackCode.INVALID_STATE: {
                    const data = { error: callbackData.error || 'Invalid authentication state' };

                    if (overrideHandlers.onInvalidState) {
                        await overrideHandlers.onInvalidState(data);
                        break;
                    }

                    console.error(`Invalid state: ${data.error}`);
                    setError(data.error);
                    clearOAuthState();
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
                    }
                    break;
                }

                case CallbackCode.USER_NOT_FOUND: {
                    const data = { error: callbackData.error || 'User not found' };

                    if (overrideHandlers.onUserNotFound) {
                        await overrideHandlers.onUserNotFound(data);
                        break;
                    }

                    console.error(`User not found: ${data.error}`);
                    setError(data.error);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/signup');
                    }
                    break;
                }

                case CallbackCode.USER_EXISTS: {
                    const data = { error: callbackData.error || 'User already exists' };

                    if (overrideHandlers.onUserExists) {
                        await overrideHandlers.onUserExists(data);
                        break;
                    }

                    console.error(`User exists: ${data.error}`);
                    setError(data.error);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
                    }
                    break;
                }

                case CallbackCode.TOKEN_EXPIRED: {
                    const data = { error: callbackData.error || 'Token expired' };

                    if (overrideHandlers.onTokenExpired) {
                        await overrideHandlers.onTokenExpired(data);
                        break;
                    }

                    console.error(`Token expired: ${data.error}`);
                    setError(data.error);
                    clearOAuthState();
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
                    }
                    break;
                }

                // Special flow cases
                case CallbackCode.PERMISSION_REAUTHORIZE: {
                    const data = {
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    };

                    if (overrideHandlers.onPermissionReauthorize) {
                        await overrideHandlers.onPermissionReauthorize(data);
                        break;
                    }

                    console.log(`Permission reauthorization needed for ${data.name} (${data.accountId}) via ${data.provider}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(`${window.location.origin}/oauth/permission/reauthorize?accountId=${data.accountId}`);
                    }
                    break;
                }

                case CallbackCode.ACCOUNT_SELECTION_REQUIRED: {
                    const data = { accounts: callbackData.accounts };

                    if (overrideHandlers.onAccountSelectionRequired) {
                        await overrideHandlers.onAccountSelectionRequired(data);
                        break;
                    }

                    console.log(`Account selection required for accounts: ${data.accounts?.join(', ')}`);
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/accounts');
                    }
                    break;
                }

                // Unknown code
                default: {
                    if (overrideHandlers.onUnknownCode) {
                        await overrideHandlers.onUnknownCode(callbackData);
                        break;
                    }

                    console.warn('Unknown callback code:', callbackData);
                    setError('Unknown callback response');
                    
                    if (enableAutoRedirect) {
                        navigateTo(window.location.origin + '/login');
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
            } else {
                setError(errorData.error);
                if (enableAutoRedirect) {
                    const loginUrl = new URL(window.location.origin + '/login');
                    if (errorData.error) {
                        loginUrl.searchParams.set('error', errorData.error);
                    }
                    navigateTo(loginUrl.toString());
                }
            }
        }
    }, [
        client, addAccount, setCurrentAccount, setOAuthTempToken, clearOAuthState,
        setError, enableAutoRedirect, customRedirectUrl, overrideHandlers, navigateTo
    ]);

    // Main callback handling function
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
                    callbackData[key] = decodeParam(value);
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