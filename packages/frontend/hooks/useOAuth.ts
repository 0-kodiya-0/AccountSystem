import { useAuth , OAuthProviders } from "@accountsystem/auth-react-sdk"

export function useOAuth() {
    const { 
        startOAuthSignup, 
        startOAuthSignin,
        requestGooglePermission,
        checkGoogleScopes,
        loadingInfo,
        hasError,
        isPending,
        isReady,
        isAuthenticated
    } = useAuth()

    const signupWithProvider = (provider: OAuthProviders) => {
        startOAuthSignup(provider)
    }

    const signinWithProvider = (provider: OAuthProviders) => {
        startOAuthSignin(provider)
    }

    return {
        signupWithProvider,
        signinWithProvider,
        requestGooglePermission,
        checkGoogleScopes,
        loadingInfo,
        hasError,
        isPending,
        isReady,
        isAuthenticated
    }
}