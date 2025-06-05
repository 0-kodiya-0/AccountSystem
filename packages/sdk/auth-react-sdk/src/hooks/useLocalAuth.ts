import { useState, useCallback } from 'react';
import { AuthSDKError, LocalSignupRequest, LocalLoginRequest } from '../types';
import { useAuth } from '../context/auth-context';
import { useAuthState, useOAuthState } from '../store/account-store';

/**
 * Hook for local authentication
 */
export const useLocalAuth = () => {
    const { 
        localSignup, 
        localLogin, 
        verifyTwoFactor, 
        requestPasswordReset, 
        resetPassword 
    } = useAuth();
    const { isAuthenticating, error } = useAuthState();
    const oauthState = useOAuthState();

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const signup = useCallback(async (data: LocalSignupRequest) => {
        try {
            setFormErrors({});
            const result = await localSignup(data);
            return result;
        } catch (err) {
            if (err instanceof AuthSDKError && err.data?.fieldErrors) {
                setFormErrors(err.data.fieldErrors);
            }
            throw err;
        }
    }, [localSignup]);

    const login = useCallback(async (data: LocalLoginRequest) => {
        try {
            setFormErrors({});
            const result = await localLogin(data);
            return result;
        } catch (err) {
            if (err instanceof AuthSDKError && err.data?.fieldErrors) {
                setFormErrors(err.data.fieldErrors);
            }
            throw err;
        }
    }, [localLogin]);

    const verify2FA = useCallback(async (code: string) => {
        if (!oauthState.tempToken) {
            throw new Error('No temporary token available for 2FA verification');
        }

        try {
            setFormErrors({});
            const result = await verifyTwoFactor({
                token: code,
                tempToken: oauthState.tempToken
            });
            return result;
        } catch (err) {
            if (err instanceof AuthSDKError && err.data?.fieldErrors) {
                setFormErrors(err.data.fieldErrors);
            }
            throw err;
        }
    }, [verifyTwoFactor, oauthState.tempToken]);

    const requestReset = useCallback(async (email: string) => {
        try {
            setFormErrors({});
            await requestPasswordReset(email);
        } catch (err) {
            if (err instanceof AuthSDKError && err.data?.fieldErrors) {
                setFormErrors(err.data.fieldErrors);
            }
            throw err;
        }
    }, [requestPasswordReset]);

    const resetPass = useCallback(async (token: string, password: string, confirmPassword: string) => {
        try {
            setFormErrors({});
            await resetPassword(token, { password, confirmPassword });
        } catch (err) {
            if (err instanceof AuthSDKError && err.data?.fieldErrors) {
                setFormErrors(err.data.fieldErrors);
            }
            throw err;
        }
    }, [resetPassword]);

    return {
        // State
        isAuthenticating,
        error,
        formErrors,
        requires2FA: !!oauthState.tempToken,
        
        // Actions
        signup,
        login,
        verify2FA,
        requestPasswordReset: requestReset,
        resetPassword: resetPass,
        
        // Utilities
        clearFormErrors: () => setFormErrors({}),
        getFieldError: (field: string) => formErrors[field] || null
    };
};
