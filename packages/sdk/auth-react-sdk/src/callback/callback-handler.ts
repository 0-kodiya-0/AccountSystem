import { CallbackCode, CallbackData, Account, OAuthProviders } from '../types';

export interface CallbackHandlers {
    // OAuth success handlers
    onOAuthSigninSuccess?: (data: { accountId: string; name: string; provider: OAuthProviders; account?: Account }) => void;
    onOAuthSignupSuccess?: (data: { accountId: string; name: string; provider: OAuthProviders; account?: Account }) => void;
    onOAuthPermissionSuccess?: (data: { accountId: string; service?: string; scopeLevel?: string; provider: OAuthProviders }) => void;
    
    // Local auth success handlers
    onLocalSigninSuccess?: (data: { accountId: string; name: string; account?: Account }) => void;
    onLocalSignupSuccess?: (data: { accountId: string; message?: string }) => void;
    onLocal2FARequired?: (data: { tempToken: string; accountId: string; message?: string }) => void;
    onLocalEmailVerified?: (data: { message?: string }) => void;
    onLocalPasswordResetSuccess?: (data: { message?: string }) => void;
    
    // Error handlers
    onOAuthError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void;
    onLocalAuthError?: (data: { error: string; code?: string }) => void;
    onPermissionError?: (data: { error: string; provider?: OAuthProviders; code?: string }) => void;
    onInvalidState?: (data: { error: string }) => void;
    onUserNotFound?: (data: { error: string }) => void;
    onUserExists?: (data: { error: string }) => void;
    onTokenExpired?: (data: { error: string }) => void;
    
    // Special flow handlers
    onPermissionReauthorize?: (data: { accountId: string; name: string; provider: OAuthProviders }) => void;
    onAccountSelectionRequired?: (data: { accounts?: string[] }) => void;
    
    // Generic handlers
    onSuccess?: (data: CallbackData) => void;
    onError?: (data: CallbackData) => void;
    onUnknownCode?: (data: CallbackData) => void;
}

export class CallbackHandler {
    private handlers: CallbackHandlers;

    constructor(handlers: CallbackHandlers) {
        this.handlers = handlers;
    }

    /**
     * Decode URL parameter value
     */
    private decodeParam(value: string): string {
        try {
            return decodeURIComponent(value);
        } catch (error) {
            console.warn('Failed to decode parameter:', value, error);
            return value; // Return original value if decoding fails
        }
    }

    /**
     * Handle callback data by routing to appropriate handlers
     */
    async handleCallback(callbackData: CallbackData): Promise<void> {
        try {
            switch (callbackData.code) {
                // OAuth success cases
                case CallbackCode.OAUTH_SIGNIN_SUCCESS:
                    await this.handlers.onOAuthSigninSuccess?.({
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                case CallbackCode.OAUTH_SIGNUP_SUCCESS:
                    await this.handlers.onOAuthSignupSuccess?.({
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                case CallbackCode.OAUTH_PERMISSION_SUCCESS:
                    await this.handlers.onOAuthPermissionSuccess?.({
                        accountId: callbackData.accountId!,
                        service: callbackData.service,
                        scopeLevel: callbackData.scopeLevel,
                        provider: callbackData.provider!
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                // Local auth success cases
                case CallbackCode.LOCAL_SIGNIN_SUCCESS:
                    await this.handlers.onLocalSigninSuccess?.({
                        accountId: callbackData.accountId!,
                        name: callbackData.name!
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                case CallbackCode.LOCAL_SIGNUP_SUCCESS:
                    await this.handlers.onLocalSignupSuccess?.({
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                case CallbackCode.LOCAL_2FA_REQUIRED:
                    await this.handlers.onLocal2FARequired?.({
                        tempToken: callbackData.tempToken!,
                        accountId: callbackData.accountId!,
                        message: callbackData.message
                    });
                    break;

                case CallbackCode.LOCAL_EMAIL_VERIFIED:
                    await this.handlers.onLocalEmailVerified?.({
                        message: callbackData.message
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                case CallbackCode.LOCAL_PASSWORD_RESET_SUCCESS:
                    await this.handlers.onLocalPasswordResetSuccess?.({
                        message: callbackData.message
                    });
                    await this.handlers.onSuccess?.(callbackData);
                    break;

                // Error cases
                case CallbackCode.OAUTH_ERROR:
                    await this.handlers.onOAuthError?.({
                        error: callbackData.error || 'OAuth authentication failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.LOCAL_AUTH_ERROR:
                    await this.handlers.onLocalAuthError?.({
                        error: callbackData.error || 'Local authentication failed',
                        code: callbackData.code
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.PERMISSION_ERROR:
                    await this.handlers.onPermissionError?.({
                        error: callbackData.error || 'Permission request failed',
                        provider: callbackData.provider,
                        code: callbackData.code
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.INVALID_STATE:
                    await this.handlers.onInvalidState?.({
                        error: callbackData.error || 'Invalid authentication state'
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.USER_NOT_FOUND:
                    await this.handlers.onUserNotFound?.({
                        error: callbackData.error || 'User not found'
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.USER_EXISTS:
                    await this.handlers.onUserExists?.({
                        error: callbackData.error || 'User already exists'
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                case CallbackCode.TOKEN_EXPIRED:
                    await this.handlers.onTokenExpired?.({
                        error: callbackData.error || 'Token expired'
                    });
                    await this.handlers.onError?.(callbackData);
                    break;

                // Special flow cases
                case CallbackCode.PERMISSION_REAUTHORIZE:
                    await this.handlers.onPermissionReauthorize?.({
                        accountId: callbackData.accountId!,
                        name: callbackData.name!,
                        provider: callbackData.provider!
                    });
                    break;

                case CallbackCode.ACCOUNT_SELECTION_REQUIRED:
                    await this.handlers.onAccountSelectionRequired?.({
                        accounts: callbackData.accounts
                    });
                    break;

                // Unknown code
                default:
                    await this.handlers.onUnknownCode?.(callbackData);
                    break;
            }
        } catch (error) {
            console.error('Error handling callback:', error);
            await this.handlers.onError?.({
                ...callbackData,
                error: error instanceof Error ? error.message : 'Unknown callback handling error'
            });
        }
    }

    /**
     * Handle callback from URLSearchParams
     */
    async handleCallbackFromParams(params: URLSearchParams): Promise<boolean> {
        const code = params.get('code');
        
        if (!code) {
            return false;
        }

        const callbackData: CallbackData = {
            code: this.decodeParam(code) as CallbackCode
        };

        // Parse all other parameters and decode them
        for (const [key, value] of params.entries()) {
            if (key !== 'code') {
                callbackData[key] = this.decodeParam(value);
            }
        }

        await this.handleCallback(callbackData);
        return true;
    }
}