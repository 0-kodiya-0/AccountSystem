import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { PasswordResetStatus } from '../types';

export interface UsePasswordResetOptions {
    redirectAfterRequest?: string;
    redirectAfterReset?: string;
    redirectDelay?: number;
    onRequestSuccess?: (message: string) => void;
    onResetSuccess?: (message: string) => void;
    onError?: (error: string) => void;
}

export interface UsePasswordResetResult {
    status: PasswordResetStatus;
    message: string | null;
    error: string | null;
    isLoading: boolean;
    
    // Actions
    requestReset: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>;
    clearState: () => void;
    redirect: (url: string) => void;
}

export const usePasswordReset = (options: UsePasswordResetOptions = {}): UsePasswordResetResult => {
    const {
        redirectAfterRequest,
        redirectAfterReset,
        redirectDelay = 3000,
        onRequestSuccess,
        onResetSuccess,
        onError
    } = options;

    const { client } = useAuth();
    
    const [status, setStatus] = useState<PasswordResetStatus>(PasswordResetStatus.IDLE);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const redirect = useCallback((url: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }, []);

    const requestReset = useCallback(async (email: string) => {
        try {
            setStatus(PasswordResetStatus.REQUESTING);

            await client.requestPasswordReset({ email });
            
            const successMessage = 'Password reset instructions have been sent to your email.';
            setStatus(PasswordResetStatus.REQUEST_SUCCESS);
            setMessage(successMessage);
            
            onRequestSuccess?.(successMessage);

            // Auto redirect after request success
            if (redirectAfterRequest) {
                setTimeout(() => {
                    redirect(redirectAfterRequest);
                }, redirectDelay);
            }

        } catch (err: any) {
            const errorMessage = err.message || 'Failed to send password reset email';
            setStatus(PasswordResetStatus.ERROR);
            setError(errorMessage);
            onError?.(errorMessage);
        }
    }, [client, setError, onRequestSuccess, onError, redirectAfterRequest, redirectDelay, redirect]);

    const resetPassword = useCallback(async (token: string, password: string, confirmPassword: string) => {
        try {
            setStatus(PasswordResetStatus.RESETTING);

            await client.resetPassword(token, { password, confirmPassword });
            
            const successMessage = 'Password reset successful! You can now sign in with your new password.';
            setStatus(PasswordResetStatus.RESET_SUCCESS);
            setMessage(successMessage);
            
            onResetSuccess?.(successMessage);

            // Auto redirect after reset success
            if (redirectAfterReset) {
                setTimeout(() => {
                    redirect(redirectAfterReset);
                }, redirectDelay);
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to reset password';
            setStatus(PasswordResetStatus.ERROR);
            setError(errorMessage);
            onError?.(errorMessage);
        }
    }, [client, setError, onResetSuccess, onError, redirectAfterReset, redirectDelay, redirect]);

    const clearState = useCallback(() => {
        setStatus(PasswordResetStatus.IDLE);
        setMessage(null);
        setError(null);
    }, []);
    
    return {
        status,
        message,
        error,
        isLoading: status === PasswordResetStatus.REQUESTING || status === PasswordResetStatus.RESETTING,
        requestReset,
        resetPassword,
        clearState,
        redirect
    };
};