import { useEffect, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccount } from './useAccount';
import { Account, AuthGuardDecision } from '../types';

export interface AuthGuardOptions {
    /**
     * Whether account selection is required
     * @default true
     */
    requireAccount?: boolean;
    
    /**
     * Whether email verification is required
     * @default false
     */
    requireEmailVerified?: boolean;
    
    /**
     * Whether to allow guest (unauthenticated) access
     * @default false
     */
    allowGuests?: boolean;
    
    /**
     * Custom redirect URLs
     */
    customRedirects?: {
        loginUrl?: string;
        accountsUrl?: string;
        customUrl?: string;
    };
    
    /**
     * Callback when redirect is triggered
     */
    onRedirect?: (destination: string, reason: AuthGuardDecision) => void;
    
    /**
     * Whether to automatically redirect or manual control
     * @default true
     */
    autoRedirect?: boolean;
}

export interface AuthGuardResult {
    /**
     * The current auth decision
     */
    decision: AuthGuardDecision;
    
    /**
     * Whether auth checks are complete (not loading)
     */
    isReady: boolean;
    
    /**
     * Where to redirect if decision requires redirect
     */
    redirectDestination?: string;
    
    /**
     * Human-readable reason for the decision
     */
    redirectReason?: string;
    
    /**
     * Current account data if available
     */
    currentAccount: Account | null;
    
    /**
     * Manual redirect function
     */
    redirect: (destination: string) => void;
    
    /**
     * Check if content should be shown
     */
    forceShowContent: () => boolean;
}

export const useAuthGuard = (options: AuthGuardOptions = {}): AuthGuardResult => {
    const {
        requireAccount = true,
        requireEmailVerified = false,
        allowGuests = false,
        customRedirects = {},
        onRedirect,
        autoRedirect = true
    } = options;

    // Get auth state from SDK
    const {
        isAuthenticated,
        hasValidSession,
        currentAccount: currentAccountFromStore,
        isLoading: authLoading,
        accounts
    } = useAuth();

    // Get current account data if we have an account ID
    const { account: currentAccount, isLoading: accountLoading } = useAccount(
        currentAccountFromStore?.id,
        {
            autoFetch: true,
            refreshOnMount: false
        }
    );

    const isLoading = authLoading || (currentAccountFromStore && accountLoading);

    // Manual redirect function
    const redirect = useCallback((destination: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = destination;
        }
    }, []);

    // Determine the auth decision
    const getAuthDecision = useCallback((): {
        decision: AuthGuardDecision;
        destination?: string;
        reason?: string;
    } => {
        // Still loading auth state
        if (isLoading) {
            return {
                decision: AuthGuardDecision.LOADING,
                reason: 'Loading authentication state'
            };
        }

        // Allow guests and no valid session
        if (allowGuests && !hasValidSession) {
            return {
                decision: AuthGuardDecision.SHOW_CONTENT,
                reason: 'Guest access allowed'
            };
        }

        // No valid session or not authenticated
        if (!hasValidSession || !isAuthenticated || accounts.length === 0) {
            return {
                decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
                destination: customRedirects.loginUrl || '/login',
                reason: 'User not authenticated'
            };
        }

        // Require account but none selected
        if (requireAccount && !currentAccountFromStore) {
            return {
                decision: AuthGuardDecision.REDIRECT_TO_ACCOUNTS,
                destination: customRedirects.accountsUrl || '/accounts',
                reason: 'No account selected'
            };
        }

        // Require account but data failed to load
        if (requireAccount && currentAccountFromStore && !currentAccount && !accountLoading) {
            return {
                decision: AuthGuardDecision.REDIRECT_TO_ACCOUNTS,
                destination: customRedirects.accountsUrl || '/accounts',
                reason: 'Account data failed to load'
            };
        }

        // Still loading account data
        if (requireAccount && accountLoading) {
            return {
                decision: AuthGuardDecision.LOADING,
                reason: 'Loading account data'
            };
        }

        // Email verification required
        if (requireEmailVerified && currentAccount && !currentAccount.userDetails.emailVerified) {
            return {
                decision: AuthGuardDecision.REDIRECT_CUSTOM,
                destination: customRedirects.customUrl || '/verify-email',
                reason: 'Email verification required'
            };
        }

        // All checks passed - show content
        return {
            decision: AuthGuardDecision.SHOW_CONTENT,
            reason: 'Authentication checks passed'
        };
    }, [
        isLoading,
        allowGuests,
        hasValidSession,
        isAuthenticated,
        requireAccount,
        currentAccountFromStore,
        currentAccount,
        accountLoading,
        requireEmailVerified,
        customRedirects,
        accounts
    ]);

    const { decision, destination, reason } = getAuthDecision();

    // Auto-redirect effect
    useEffect(() => {
        if (autoRedirect && destination && 
            (decision === AuthGuardDecision.REDIRECT_TO_LOGIN ||
             decision === AuthGuardDecision.REDIRECT_TO_ACCOUNTS ||
             decision === AuthGuardDecision.REDIRECT_CUSTOM)) {
            
            // Call onRedirect callback if provided
            onRedirect?.(destination, decision);
            
            // Perform redirect
            redirect(destination);
        }
    }, [autoRedirect, destination, decision]);

    // Force show content function (for manual override)
    const forceShowContent = useCallback(() => {
        return decision === AuthGuardDecision.SHOW_CONTENT;
    }, [decision]);

    return {
        decision,
        isReady: decision !== AuthGuardDecision.LOADING,
        redirectDestination: destination,
        redirectReason: reason,
        currentAccount,
        redirect,
        forceShowContent
    };
};