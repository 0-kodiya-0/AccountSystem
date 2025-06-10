import { useAuth , OAuthProviders } from "@accountsystem/auth-react-sdk"

export function useOAuth() {
    const { 
        startOAuthSignup, 
        startOAuthSignin,
        requestGooglePermission,
        checkGoogleScopes,
        isAuthenticating,
        error,
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
        isAuthenticating,
        error,
    }
}