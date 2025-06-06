import { useAuth } from "@accountsystem/auth-react-sdk"
import { OAuthProviders } from "@accountsystem/auth-react-sdk"

export function useOAuth() {
    const { 
        startOAuthSignup, 
        startOAuthSignin,
        handleOAuthCallback,
        requestGooglePermission,
        checkGoogleScopes,
        isAuthenticating,
        error,
        oauthState
    } = useAuth()

    const signupWithProvider = (provider: OAuthProviders, redirectUrl?: string) => {
        startOAuthSignup(provider, redirectUrl)
    }

    const signinWithProvider = (provider: OAuthProviders, redirectUrl?: string) => {
        startOAuthSignin(provider, redirectUrl)
    }

    const handleCallback = async (params: URLSearchParams) => {
        return await handleOAuthCallback(params)
    }

    const requestPermissions = (accountId: string, scopes: string[], redirectUrl?: string) => {
        requestGooglePermission(accountId, scopes, redirectUrl)
    }

    const checkPermissions = async (accountId: string, scopes: string[]) => {
        return await checkGoogleScopes(accountId, scopes)
    }

    return {
        signupWithProvider,
        signinWithProvider,
        handleOAuthCallback: handleCallback,
        requestGooglePermission: requestPermissions,
        checkGoogleScopes: checkPermissions,
        isAuthenticating,
        error,
        oauthState
    }
}