import {
    useAuth,
    LocalSignupRequest,
    LocalLoginRequest,
    LocalLoginResponse,
    ResetPasswordRequest
} from "../../sdk/auth-react-sdk/src"

export function useLocalAuth() {
    const {
        localSignup,
        localLogin,
        verifyTwoFactor,
        requestPasswordReset,
        resetPassword,
        tempToken,
        isAuthenticated,
        loadingInfo,
        isPending,
        isReady,
        hasError
    } = useAuth()

    const signup = async (data: LocalSignupRequest) => {
        return await localSignup(data)
    }

    const login = async (data: LocalLoginRequest): Promise<LocalLoginResponse> => {
        return await localLogin(data)
    }

    const verify2FA = async (token: string): Promise<LocalLoginResponse> => {
        if (!tempToken) {
            throw new Error("No temporary token available")
        }

        return await verifyTwoFactor({
            token,
            tempToken
        })
    }

    const requestReset = async (email: string) => {
        return await requestPasswordReset(email)
    }

    const resetPass = async (token: string, data: ResetPasswordRequest) => {
        return await resetPassword(token, data)
    }

    return {
        signup,
        login,
        verify2FA,
        requestPasswordReset: requestReset,
        resetPassword: resetPass,
        requires2FA: !!tempToken,
        loadingInfo,
        isPending,
        isReady,
        isAuthenticated,
        hasError
    }
}
