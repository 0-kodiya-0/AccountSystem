import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { TwoFactorVerifyRequest, LocalLoginResponse, TwoFactorVerificationStatus } from '../types';

export interface Use2FAVerificationOptions {
    tempToken?: string;
    maxAttempts?: number;
    lockoutDuration?: number;
    redirectAfterSuccess?: string;
    redirectDelay?: number;
    onSuccess?: (accountId: string, name?: string) => void;
    onError?: (error: string, attemptsRemaining?: number) => void;
    onLockout?: (lockoutDuration: number) => void;
    autoRedirectOnSuccess?: boolean;
}

export interface Use2FAVerificationResult {
    status: TwoFactorVerificationStatus;
    message: string | null;
    error: string | null;
    attemptsRemaining: number | null;
    lockoutTimeRemaining: number | null;
    isLoading: boolean;
    canRetry: boolean;
    
    // Actions
    verify: (token: string, isBackupCode?: boolean) => Promise<void>;
    resendCode: () => Promise<void>;
    useBackupCode: (code: string) => Promise<void>;
    clearError: () => void;
    redirect: (url: string) => void;
    startOver: () => void;
}

export const use2FAVerification = (options: Use2FAVerificationOptions = {}): Use2FAVerificationResult => {
    const {
        tempToken,
        maxAttempts = 5,
        lockoutDuration = 300000, // 5 minutes
        redirectAfterSuccess,
        redirectDelay = 2000,
        onSuccess,
        onError,
        onLockout,
        autoRedirectOnSuccess = true
    } = options;

    const { verifyTwoFactor, refreshSession, setError, clearError: clearAuthError, oauthState } = useAuth();
    
    // Use tempToken from options or from auth state
    const activeTempToken = tempToken || oauthState.tempToken;

    const [status, setStatus] = useState<TwoFactorVerificationStatus>(
        activeTempToken ? TwoFactorVerificationStatus.IDLE : TwoFactorVerificationStatus.EXPIRED_SESSION
    );
    const [message, setMessage] = useState<string | null>(null);
    const [error, setErrorState] = useState<string | null>(null);
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(maxAttempts);
    const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState<number | null>(null);
    const [lockoutTimer, setLockoutTimer] = useState<NodeJS.Timeout | null>(null);

    const redirect = useCallback((url: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }, []);

    const clearError = useCallback(() => {
        setErrorState(null);
        clearAuthError();
    }, [clearAuthError]);

    const startLockout = useCallback((duration: number) => {
        setStatus(TwoFactorVerificationStatus.LOCKED_OUT);
        setLockoutTimeRemaining(duration);
        setMessage(`Too many failed attempts. Try again in ${Math.ceil(duration / 60000)} minutes.`);
        
        onLockout?.(duration);

        // Countdown timer
        const timer = setInterval(() => {
            setLockoutTimeRemaining(prev => {
                if (prev === null || prev <= 1000) {
                    clearInterval(timer);
                    setStatus(TwoFactorVerificationStatus.IDLE);
                    setLockoutTimeRemaining(null);
                    setMessage(null);
                    setAttemptsRemaining(maxAttempts);
                    return null;
                }
                return prev - 1000;
            });
        }, 1000);

        setLockoutTimer(timer);
    }, [maxAttempts, onLockout]);

    const verify = useCallback(async (token: string, isBackupCode: boolean = false) => {
        if (!activeTempToken) {
            setStatus(TwoFactorVerificationStatus.EXPIRED_SESSION);
            setErrorState('Session expired. Please sign in again.');
            setError('Session expired. Please sign in again.');
            return;
        }

        if (status === TwoFactorVerificationStatus.LOCKED_OUT) {
            return;
        }

        try {
            setStatus(TwoFactorVerificationStatus.VERIFYING);
            setErrorState(null);
            clearAuthError();

            const verifyRequest: TwoFactorVerifyRequest = {
                token,
                tempToken: activeTempToken
            };

            const response: LocalLoginResponse = await verifyTwoFactor(verifyRequest);

            if (response.accountId) {
                setStatus(TwoFactorVerificationStatus.SUCCESS);
                setMessage(`Welcome back! Authentication successful.`);
                setAttemptsRemaining(null);
                
                // Refresh session to get updated auth state
                await refreshSession();
                
                onSuccess?.(response.accountId, response.name);

                // Auto-redirect if configured
                if (autoRedirectOnSuccess && redirectAfterSuccess) {
                    setTimeout(() => {
                        redirect(redirectAfterSuccess);
                    }, redirectDelay);
                }
            } else {
                throw new Error('Verification failed - no account ID returned');
            }

        } catch (err: any) {
            const newAttemptsRemaining = (attemptsRemaining || maxAttempts) - 1;
            setAttemptsRemaining(newAttemptsRemaining);

            let errorMessage = 'Invalid verification code';
            let errorStatus = TwoFactorVerificationStatus.INVALID_TOKEN;

            // Parse specific error types
            if (err.message?.includes('expired') || err.message?.includes('timeout')) {
                errorStatus = TwoFactorVerificationStatus.EXPIRED_SESSION;
                errorMessage = 'Session expired. Please sign in again.';
            } else if (err.message?.includes('invalid') || err.message?.includes('incorrect')) {
                errorMessage = isBackupCode ? 'Invalid backup code' : 'Invalid verification code';
                if (newAttemptsRemaining > 0) {
                    errorMessage += `. ${newAttemptsRemaining} attempts remaining.`;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            // Check for lockout
            if (newAttemptsRemaining <= 0) {
                startLockout(lockoutDuration);
                return;
            }

            setStatus(errorStatus);
            setErrorState(errorMessage);
            setError(errorMessage);
            
            onError?.(errorMessage, newAttemptsRemaining);
        }
    }, [
        activeTempToken, status, attemptsRemaining, maxAttempts, verifyTwoFactor, 
        refreshSession, clearAuthError, setError, onSuccess, onError, 
        autoRedirectOnSuccess, redirectAfterSuccess, redirectDelay, redirect, 
        startLockout, lockoutDuration
    ]);

    const useBackupCode = useCallback(async (code: string) => {
        await verify(code, true);
    }, [verify]);

    const resendCode = useCallback(async () => {
        // This would typically trigger a resend of SMS/email if supported
        // For TOTP apps, this isn't applicable, but could be useful for SMS 2FA
        setMessage('Generate a new code from your authenticator app.');
        setTimeout(() => setMessage(null), 3000);
    }, []);

    const startOver = useCallback(() => {
        if (lockoutTimer) {
            clearInterval(lockoutTimer);
            setLockoutTimer(null);
        }
        
        setStatus(activeTempToken ? TwoFactorVerificationStatus.IDLE : TwoFactorVerificationStatus.EXPIRED_SESSION);
        setMessage(null);
        setErrorState(null);
        setAttemptsRemaining(maxAttempts);
        setLockoutTimeRemaining(null);
        clearAuthError();
    }, [lockoutTimer, activeTempToken, maxAttempts, clearAuthError]);

    // Check for expired session on mount
    useEffect(() => {
        if (!activeTempToken) {
            setStatus(TwoFactorVerificationStatus.EXPIRED_SESSION);
            setErrorState('No active 2FA session found. Please sign in again.');
        }
    }, [activeTempToken]);

    // Cleanup lockout timer on unmount
    useEffect(() => {
        return () => {
            if (lockoutTimer) {
                clearInterval(lockoutTimer);
            }
        };
    }, [lockoutTimer]);

    return {
        status,
        message,
        error: error,
        attemptsRemaining,
        lockoutTimeRemaining,
        isLoading: status === TwoFactorVerificationStatus.VERIFYING,
        canRetry: status !== TwoFactorVerificationStatus.LOCKED_OUT && 
                  status !== TwoFactorVerificationStatus.EXPIRED_SESSION &&
                  (attemptsRemaining === null || attemptsRemaining > 0),
        verify,
        resendCode,
        useBackupCode,
        clearError,
        redirect,
        startOver
    };
};