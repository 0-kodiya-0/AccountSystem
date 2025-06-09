import { useCallback, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccountStore } from '../store/account-store';
import { useAccount } from './useAccount';
import { RedirectCode } from '../types';

// Handler that receives data and optional default implementation
type RedirectHandlerWithDefault<T> = (data: T, defaultHandler: () => Promise<void>) => void | Promise<void>;

// Handler for cases that don't need data
type RedirectHandlerWithoutData = (defaultHandler: () => Promise<void>) => void | Promise<void>;

interface UseAuthRedirectHandlerOptions {
    // Configuration
    defaultHomeUrl: string;
    defaultLoginUrl: string;
    defaultAccountsUrl: string;
    autoRedirect?: boolean;

    // Complete override handlers - if provided, default won't run unless called
    onAuthenticatedWithAccount?: RedirectHandlerWithDefault<{ accountId: string; redirectUrl: string }>;
    onAccountSelectionRequired?: RedirectHandlerWithoutData;
    onNoAuthentication?: RedirectHandlerWithoutData;
    onAccountDataLoadFailed?: RedirectHandlerWithDefault<{ accountId: string }>;
}

interface RedirectDecision {
    action: 'redirect' | 'wait' | 'none';
    code: RedirectCode;
    destination?: string;
    data?: Record<string, unknown>;
}

interface UseAuthRedirectHandlerReturn {
    handleRedirect: () => Promise<void>;
    getRedirectDecision: () => RedirectDecision;
    isReady: boolean;
    redirectCode: RedirectCode | null;
}

export const useAuthRedirectHandler = (options: UseAuthRedirectHandlerOptions): UseAuthRedirectHandlerReturn => {
    const {
        defaultHomeUrl,
        defaultLoginUrl,
        defaultAccountsUrl,
        autoRedirect = true,
        ...handlers
    } = options;

    const {
        isAuthenticated,
        hasValidSession,
        isLoading: authLoading
    } = useAuth();

    const {
        getCurrentAccountId,
        hasAccounts
    } = useAccountStore();

    const currentAccountId = getCurrentAccountId();
    const { account: currentAccount, isLoading: accountLoading } = useAccount(
        currentAccountId || undefined,
        { autoFetch: true, refreshOnMount: false }
    );

    const isLoading = authLoading || (currentAccountId && accountLoading);

    // Simple navigation helper
    const navigateToUrl = useCallback((url: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }, []);

    // Create default handlers
    const defaultAuthenticatedWithAccount = useCallback(async (data: { accountId: string; redirectUrl: string }) => {
        console.log(`Redirecting authenticated user to: ${data.redirectUrl}`);
        navigateToUrl(data.redirectUrl);
    }, [navigateToUrl]);

    const defaultAccountSelectionRequired = useCallback(async () => {
        console.log('Account selection required, redirecting to accounts page');
        navigateToUrl(defaultAccountsUrl);
    }, [defaultAccountsUrl, navigateToUrl]);

    const defaultNoAuthentication = useCallback(async () => {
        console.log('No authentication, redirecting to login');
        navigateToUrl(defaultLoginUrl);
    }, [defaultLoginUrl, navigateToUrl]);

    const defaultAccountDataLoadFailed = useCallback(async (data: { accountId: string }) => {
        console.warn(`Account data load failed for ${data.accountId}, redirecting to accounts page`);
        navigateToUrl(defaultAccountsUrl);
    }, [defaultAccountsUrl, navigateToUrl]);

    // Core redirect decision logic
    const getRedirectDecision = useCallback((): RedirectDecision => {
        if (isLoading) {
            return {
                action: 'wait',
                code: RedirectCode.LOADING_AUTH_STATE
            };
        }

        if (!hasValidSession) {
            return {
                action: 'redirect',
                code: RedirectCode.NO_AUTHENTICATION,
                destination: defaultLoginUrl
            };
        }

        if (isAuthenticated && hasAccounts()) {
            if (currentAccountId) {
                if (currentAccount) {
                    return {
                        action: 'redirect',
                        code: RedirectCode.AUTHENTICATED_WITH_ACCOUNT,
                        destination: defaultHomeUrl,
                        data: {
                            accountId: currentAccount.id,
                            redirectUrl: defaultHomeUrl
                        }
                    };
                } else if (!accountLoading) {
                    return {
                        action: 'redirect',
                        code: RedirectCode.ACCOUNT_DATA_LOAD_FAILED,
                        destination: defaultAccountsUrl,
                        data: { accountId: currentAccountId }
                    };
                } else {
                    return {
                        action: 'wait',
                        code: RedirectCode.LOADING_ACCOUNT_DATA
                    };
                }
            } else {
                return {
                    action: 'redirect',
                    code: RedirectCode.ACCOUNT_SELECTION_REQUIRED,
                    destination: defaultAccountsUrl
                };
            }
        } else {
            return {
                action: 'redirect',
                code: RedirectCode.NO_AUTHENTICATION,
                destination: defaultLoginUrl
            };
        }
    }, [
        isLoading, hasValidSession, isAuthenticated, hasAccounts,
        currentAccountId, currentAccount, accountLoading,
        defaultHomeUrl, defaultAccountsUrl, defaultLoginUrl
    ]);

    // Execute redirect based on decision - simple override OR default logic
    const executeRedirect = useCallback(async (decision: RedirectDecision): Promise<void> => {
        if (decision.action !== 'redirect' || !decision.destination) return;

        try {
            switch (decision.code) {
                case RedirectCode.AUTHENTICATED_WITH_ACCOUNT: {
                    const data = {
                        accountId: decision.data?.accountId as string,
                        redirectUrl: decision.destination
                    };

                    if (handlers.onAuthenticatedWithAccount) {
                        // Override provided - call it with default that has data pre-bound
                        await handlers.onAuthenticatedWithAccount(data, () => defaultAuthenticatedWithAccount(data));
                    } else {
                        // No override - call default
                        await defaultAuthenticatedWithAccount(data);
                    }
                    break;
                }

                case RedirectCode.ACCOUNT_SELECTION_REQUIRED: {
                    if (handlers.onAccountSelectionRequired) {
                        await handlers.onAccountSelectionRequired(defaultAccountSelectionRequired);
                    } else {
                        await defaultAccountSelectionRequired();
                    }
                    break;
                }

                case RedirectCode.NO_AUTHENTICATION: {
                    if (handlers.onNoAuthentication) {
                        await handlers.onNoAuthentication(defaultNoAuthentication);
                    } else {
                        await defaultNoAuthentication();
                    }
                    break;
                }

                case RedirectCode.ACCOUNT_DATA_LOAD_FAILED: {
                    const data = { accountId: decision.data?.accountId as string };

                    if (handlers.onAccountDataLoadFailed) {
                        // Override provided - call it with default that has data pre-bound
                        await handlers.onAccountDataLoadFailed(data, () => defaultAccountDataLoadFailed(data));
                    } else {
                        // No override - call default
                        await defaultAccountDataLoadFailed(data);
                    }
                    break;
                }

                default: {
                    console.warn('Unknown redirect code:', decision.code);
                    navigateToUrl(decision.destination);
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing redirect:', error);
            // Final fallback
            navigateToUrl(decision.destination);
        }
    }, [
        handlers,
        defaultAuthenticatedWithAccount,
        defaultAccountSelectionRequired,
        defaultNoAuthentication,
        defaultAccountDataLoadFailed,
        navigateToUrl
    ]);

    // Main redirect handler
    const handleRedirect = useCallback(async (): Promise<void> => {
        const decision = getRedirectDecision();
        await executeRedirect(decision);
    }, [getRedirectDecision, executeRedirect]);

    // Auto-redirect when ready
    useEffect(() => {
        if (!autoRedirect) return;

        const decision = getRedirectDecision();
        if (decision.action === 'redirect') {
            executeRedirect(decision);
        }
    }, [autoRedirect]);

    return {
        handleRedirect,
        getRedirectDecision,
        isReady: getRedirectDecision().action !== 'wait',
        redirectCode: getRedirectDecision().code
    };
};