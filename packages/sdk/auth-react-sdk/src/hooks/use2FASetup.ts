import { useState, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { TwoFactorSetupRequest, TwoFactorSetupResponse, TwoFactorSetupStatus } from '../types';

export interface Use2FASetupOptions {
    accountId?: string;
    autoGenerateBackupCodes?: boolean;
    redirectAfterComplete?: string;
    redirectDelay?: number;
    onSetupReady?: (qrCode: string, secret: string) => void;
    onVerified?: (message: string) => void;
    onBackupCodesGenerated?: (codes: string[]) => void;
    onComplete?: (backupCodes?: string[]) => void;
    onError?: (error: string) => void;
}

export interface Use2FASetupResult {
    status: TwoFactorSetupStatus;
    qrCode: string | null;
    secret: string | null;
    backupCodes: string[] | null;
    message: string | null;
    error: string | null;
    isLoading: boolean;
    
    // Actions
    startSetup: (password: string) => Promise<void>;
    verifySetup: (token: string) => Promise<void>;
    generateBackupCodes: (password: string) => Promise<void>;
    downloadBackupCodes: (filename?: string) => void;
    reset: () => void;
    redirect: (url: string) => void;
}

export const use2FASetup = (options: Use2FASetupOptions = {}): Use2FASetupResult => {
    const {
        accountId: providedAccountId,
        autoGenerateBackupCodes = true,
        redirectAfterComplete,
        redirectDelay = 3000,
        onSetupReady,
        onVerified,
        onBackupCodesGenerated,
        onComplete,
        onError
    } = options;

    const { client, currentAccount } = useAuth();
    const accountId = providedAccountId || currentAccount?.id;

    const [status, setStatus] = useState<TwoFactorSetupStatus>(TwoFactorSetupStatus.IDLE);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const redirect = useCallback((url: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }, []);

    const startSetup = useCallback(async (password: string) => {
        if (!accountId) {
            const errorMsg = 'No account ID available for 2FA setup';
            setError(errorMsg);
            onError?.(errorMsg);
            return;
        }

        try {
            setStatus(TwoFactorSetupStatus.REQUESTING_SETUP);
            setError(null);

            const setupData: TwoFactorSetupRequest = {
                password,
                enableTwoFactor: true
            };

            const response: TwoFactorSetupResponse = await client.setupTwoFactor(accountId, setupData);
            
            setQrCode(response.qrCode || null);
            setSecret(response.secret || null);
            setStatus(TwoFactorSetupStatus.SETUP_READY);
            setMessage('Scan the QR code with your authenticator app and enter the verification code.');
            
            onSetupReady?.(response.qrCode || '', response.secret || '');

        } catch (err: any) {
            const errorMsg = err.message || 'Failed to initialize 2FA setup';
            setStatus(TwoFactorSetupStatus.ERROR);
            setError(errorMsg);
            onError?.(errorMsg);
        }
    }, [accountId, client, setError, onSetupReady, onError]);

    const verifySetup = useCallback(async (token: string) => {
        if (!accountId) {
            const errorMsg = 'No account ID available for 2FA verification';
            setError(errorMsg);
            onError?.(errorMsg);
            return;
        }

        try {
            setStatus(TwoFactorSetupStatus.VERIFYING_TOKEN);
            setError(null);

            const response = await client.verifyTwoFactorSetup(accountId, token);
            
            setMessage(response.message || '2FA verification successful!');
            onVerified?.(response.message || '2FA verification successful!');

            // Auto-generate backup codes if enabled
            if (autoGenerateBackupCodes) {
                setStatus(TwoFactorSetupStatus.GENERATING_BACKUP_CODES);
                setMessage('Generating backup codes...');
                // Note: This would need password again, might need to store it or ask again
                // For now, we'll skip auto-generation and require manual trigger
                setStatus(TwoFactorSetupStatus.COMPLETE);
                setMessage('2FA setup complete! Generate backup codes for account recovery.');
                onComplete?.();
            } else {
                setStatus(TwoFactorSetupStatus.COMPLETE);
                setMessage('2FA setup complete!');
                onComplete?.();
            }

            // Auto redirect after completion
            if (redirectAfterComplete) {
                setTimeout(() => {
                    redirect(redirectAfterComplete);
                }, redirectDelay);
            }

        } catch (err: any) {
            const errorMsg = err.message || 'Failed to verify 2FA setup';
            setStatus(TwoFactorSetupStatus.ERROR);
            setError(errorMsg);
            onError?.(errorMsg);
        }
    }, [accountId, client, setError, autoGenerateBackupCodes, onVerified, onComplete, onError, redirectAfterComplete, redirectDelay, redirect]);

    const generateBackupCodes = useCallback(async (password: string) => {
        if (!accountId) {
            const errorMsg = 'No account ID available for backup code generation';
            setError(errorMsg);
            onError?.(errorMsg);
            return;
        }

        try {
            setStatus(TwoFactorSetupStatus.GENERATING_BACKUP_CODES);
            setError(null);

            const response = await client.generateBackupCodes(accountId, password);
            
            setBackupCodes(response.backupCodes);
            setStatus(TwoFactorSetupStatus.COMPLETE);
            setMessage('2FA setup complete! Save your backup codes in a safe place.');
            
            onBackupCodesGenerated?.(response.backupCodes);
            onComplete?.(response.backupCodes);

            // Auto redirect after backup codes generation
            if (redirectAfterComplete) {
                setTimeout(() => {
                    redirect(redirectAfterComplete);
                }, redirectDelay);
            }

        } catch (err: any) {
            const errorMsg = err.message || 'Failed to generate backup codes';
            setStatus(TwoFactorSetupStatus.ERROR);
            setError(errorMsg);
            onError?.(errorMsg);
        }
    }, [accountId, client, setError, onBackupCodesGenerated, onComplete, onError, redirectAfterComplete, redirectDelay, redirect]);

    const downloadBackupCodes = useCallback((filename: string = 'backup-codes.txt') => {
        if (!backupCodes || backupCodes.length === 0) {
            return;
        }

        const content = [
            '2FA Backup Codes',
            '=================',
            '',
            'Save these backup codes in a safe place.',
            'Each code can only be used once.',
            '',
            ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
            '',
            `Generated on: ${new Date().toLocaleString()}`,
            `Account: ${currentAccount?.userDetails.email || 'Unknown'}`
        ].join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [backupCodes, currentAccount]);

    const reset = useCallback(() => {
        setStatus(TwoFactorSetupStatus.IDLE);
        setQrCode(null);
        setSecret(null);
        setBackupCodes(null);
        setMessage(null);
        setError(null)
    }, []);

    return {
        status,
        qrCode,
        secret,
        backupCodes,
        message,
        error,
        isLoading: status === TwoFactorSetupStatus.REQUESTING_SETUP || 
                   status === TwoFactorSetupStatus.VERIFYING_TOKEN ||
                   status === TwoFactorSetupStatus.GENERATING_BACKUP_CODES,
        startSetup,
        verifySetup,
        generateBackupCodes,
        downloadBackupCodes,
        reset,
        redirect
    };
};