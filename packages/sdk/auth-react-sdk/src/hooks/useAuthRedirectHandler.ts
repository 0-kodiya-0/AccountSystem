import { useCallback, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccountStore } from '../store/account-store';
import { useAccount } from './useAccount';
import { RedirectCode } from '../types';

interface UseAuthRedirectHandlerOptions {
    // Redirect handlers
    onAuthenticatedWithAccount?: (data: { accountId: string; redirectUrl: string }) => void | Promise<void>;
    onAuthenticatedNoAccount?: () => void | Promise<void>;
    onAccountSelectionRequired?: () => void | Promise<void>;
    onAccountDataLoadFailed?: (data: { accountId: string }) => void | Promise<void>;
    onNoAuthentication?: () => void | Promise<void>;
    onHasAccountsButNoneActive?: () => void | Promise<void>;

    // Configuration
    defaultHomeUrl: string;
    defaultLoginUrl: string;
    defaultAccountsUrl: string;
    disableDefaultHandlers?: boolean;
    autoRedirect?: boolean;
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
        disableDefaultHandlers = false,
        autoRedirect = true,
        ...overrideHandlers
    } = options;

    const hasActiveAccounts = useAccountStore(state => state.hasActiveAccounts);
    
    const {
        isAuthenticated,
        currentAccount: currentAccountFromStore,
        isLoading: authLoading
    } = useAuth();

    // Use useAccount hook to get current account data if we have an account ID
    const { account: currentAccount, isLoading: accountLoading } = useAccount(
        currentAccountFromStore?.id,
        {
            autoFetch: true,
            refreshOnMount: false
        }
    );

    const isLoading = authLoading || (currentAccountFromStore && accountLoading);

    // Simple navigation helper
    const navigateToUrl = useCallback((url: string) => {
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }, []);

    // Core redirect decision logic
    const getRedirectDecision = useCallback((): RedirectDecision => {
        // Still loading - wait
        if (isLoading) {
            return {
                action: 'wait',
                code: RedirectCode.LOADING_AUTH_STATE
            };
        }

        // User is authenticated and has active accounts
        if (isAuthenticated && hasActiveAccounts()) {
            if (currentAccountFromStore) {
                if (currentAccount) {
                    // User is fully authenticated with account data
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
                    // Account ID exists but failed to load data
                    return {
                        action: 'redirect',
                        code: RedirectCode.ACCOUNT_DATA_LOAD_FAILED,
                        destination: defaultAccountsUrl,
                        data: { accountId: currentAccountFromStore.id }
                    };
                } else {
                    // Still loading account data
                    return {
                        action: 'wait',
                        code: RedirectCode.LOADING_ACCOUNT_DATA
                    };
                }
            } else {
                // Has accounts but no current account selected
                return {
                    action: 'redirect',
                    code: RedirectCode.ACCOUNT_SELECTION_REQUIRED,
                    destination: defaultAccountsUrl
                };
            }
        } 
        
        // User has accounts but none currently active
        else if (hasActiveAccounts()) {
            return {
                action: 'redirect',
                code: RedirectCode.HAS_ACCOUNTS_BUT_NONE_ACTIVE,
                destination: defaultAccountsUrl
            };
        } 
        
        // No authentication
        else {
            return {
                action: 'redirect',
                code: RedirectCode.NO_AUTHENTICATION,
                destination: defaultLoginUrl
            };
        }
    }, [
        isLoading,
        isAuthenticated,
        hasActiveAccounts,
        currentAccountFromStore,
        currentAccount,
        accountLoading,
        defaultHomeUrl,
        defaultAccountsUrl,
        defaultLoginUrl
    ]);

    // Execute redirect based on decision
    const executeRedirect = useCallback(async (decision: RedirectDecision): Promise<void> => {
        if (decision.action !== 'redirect' || !decision.destination) return;

        try {
            switch (decision.code) {
                case RedirectCode.AUTHENTICATED_WITH_ACCOUNT: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onAuthenticatedWithAccount) {
                        await overrideHandlers.onAuthenticatedWithAccount({
                            accountId: decision.data?.accountId as string,
                            redirectUrl: decision.destination
                        });
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log(`Redirecting authenticated user to: ${decision.destination}`);
                        navigateToUrl(decision.destination);
                    }
                    break;
                }

                case RedirectCode.ACCOUNT_DATA_LOAD_FAILED: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onAccountDataLoadFailed) {
                        await overrideHandlers.onAccountDataLoadFailed({
                            accountId: decision.data?.accountId as string
                        });
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.warn(`Account data load failed for ${decision.data?.accountId}, redirecting to accounts page`);
                        navigateToUrl(decision.destination);
                    }
                    break;
                }

                case RedirectCode.ACCOUNT_SELECTION_REQUIRED: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onAccountSelectionRequired) {
                        await overrideHandlers.onAccountSelectionRequired();
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log('Account selection required, redirecting to accounts page');
                        navigateToUrl(decision.destination);
                    }
                    break;
                }

                case RedirectCode.HAS_ACCOUNTS_BUT_NONE_ACTIVE: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onHasAccountsButNoneActive) {
                        await overrideHandlers.onHasAccountsButNoneActive();
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log('Has accounts but none active, redirecting to accounts page');
                        navigateToUrl(decision.destination);
                    }
                    break;
                }

                case RedirectCode.NO_AUTHENTICATION: {
                    // Always run override handler first if provided
                    if (overrideHandlers.onNoAuthentication) {
                        await overrideHandlers.onNoAuthentication();
                    }

                    // Run default handler unless disabled
                    if (!disableDefaultHandlers) {
                        console.log('No authentication, redirecting to login');
                        navigateToUrl(decision.destination);
                    }
                    break;
                }

                default: {
                    console.warn('Unknown redirect code:', decision.code);
                    if (!disableDefaultHandlers) {
                        navigateToUrl(decision.destination);
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing redirect:', error);
            
            // Fallback to default redirect on error
            if (!disableDefaultHandlers) {
                navigateToUrl(decision.destination);
            }
        }
    }, [
        overrideHandlers,
        disableDefaultHandlers,
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
    }, [autoRedirect, getRedirectDecision, executeRedirect]);

    const decision = getRedirectDecision();

    return {
        handleRedirect,
        getRedirectDecision,
        isReady: decision.action !== 'wait',
        redirectCode: decision.code
    };
};