import { useEffect, useCallback } from 'react';
import { OAuthProviders } from '../types';
import { useAuth } from '../context/auth-context';
import { useAuthState, useOAuthState } from '../store/account-store';

/**
 * Hook for OAuth authentication flows
 */
export const useOAuth = () => {
    const { startOAuthSignup, startOAuthSignin, handleOAuthCallback } = useAuth();
    const oauthState = useOAuthState();
    const { isAuthenticating, error } = useAuthState();

    const signupWithProvider = useCallback((provider: OAuthProviders, redirectUrl?: string) => {
        startOAuthSignup(provider, redirectUrl);
    }, [startOAuthSignup]);

    const signinWithProvider = useCallback((provider: OAuthProviders, redirectUrl?: string) => {
        startOAuthSignin(provider, redirectUrl);
    }, [startOAuthSignin]);

    const isOAuthCallback = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        return params.has('state') && (params.has('code') || params.has('error'));
    }, []);

    // Handle OAuth callback when component mounts
    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            if (params.has('state') && params.has('code')) {
                await handleOAuthCallback(params);
            }
        };

        handleCallback();
    }, []);

    return {
        // State
        isInProgress: oauthState.isInProgress,
        provider: oauthState.provider,
        isAuthenticating,
        error,

        // Actions
        signupWithProvider,
        signinWithProvider,

        // Utilities
        isOAuthCallback
    };
};
