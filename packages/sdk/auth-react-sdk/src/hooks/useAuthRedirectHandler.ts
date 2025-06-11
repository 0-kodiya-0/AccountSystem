import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { RedirectCode } from '../types';

type RedirectHandlerWithDefault<T> = (data: T, defaultHandler: () => void) => void;
type RedirectHandlerWithoutData = (defaultHandler: () => void) => void;

interface UseAuthRedirectHandlerOptions {
  defaultHomeUrl: string;
  defaultLoginUrl: string;
  defaultAccountsUrl: string;
  onAuthenticatedWithAccount?: RedirectHandlerWithDefault<{
    accountId: string;
    redirectUrl: string;
  }>;
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

const calculateRedirectDecision = (
  hasValidSession: boolean,
  isAuthenticated: boolean,
  hasAccounts: boolean,
  currentAccountId: string | null,
  defaultHomeUrl: string,
  defaultLoginUrl: string,
  defaultAccountsUrl: string,
): RedirectDecision => {
  if (!hasValidSession) {
    return {
      action: 'redirect',
      code: RedirectCode.NO_AUTHENTICATION,
      destination: defaultLoginUrl,
    };
  }

  if (isAuthenticated && hasAccounts) {
    if (currentAccountId) {
      return {
        action: 'redirect',
        code: RedirectCode.AUTHENTICATED_WITH_ACCOUNT,
        destination: defaultHomeUrl,
        data: {
          accountId: currentAccountId,
          redirectUrl: defaultHomeUrl,
        },
      };
    } else {
      return {
        action: 'redirect',
        code: RedirectCode.ACCOUNT_SELECTION_REQUIRED,
        destination: defaultAccountsUrl,
      };
    }
  } else {
    return {
      action: 'redirect',
      code: RedirectCode.NO_AUTHENTICATION,
      destination: defaultLoginUrl,
    };
  }
};

export const useAuthRedirectHandler = (options: UseAuthRedirectHandlerOptions) => {
  const { defaultHomeUrl, defaultLoginUrl, defaultAccountsUrl, ...handlers } = options;

  const { session, isAuthenticated, accounts } = useAuth();

  const hasAccounts = accounts.length > 0;
  const hasValidSession = session.hasSession && session.isValid;

  const redirectUrls = useMemo(
    () => ({
      home: defaultHomeUrl,
      login: defaultLoginUrl,
      accounts: defaultAccountsUrl,
    }),
    [defaultHomeUrl, defaultLoginUrl, defaultAccountsUrl],
  );

  const navigateToUrl = useCallback((url: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, []);

  const redirectDecision = useMemo(() => {
    return calculateRedirectDecision(
      hasValidSession,
      isAuthenticated,
      hasAccounts,
      session.currentAccountId,
      redirectUrls.home,
      redirectUrls.login,
      redirectUrls.accounts,
    );
  }, [
    hasValidSession,
    isAuthenticated,
    hasAccounts,
    session.currentAccountId,
    redirectUrls.home,
    redirectUrls.login,
    redirectUrls.accounts,
  ]);

  const getRedirectDecision = useCallback(() => redirectDecision, [redirectDecision]);

  const executeRedirect = useCallback(
    (decision: RedirectDecision) => {
      if (decision.action !== 'redirect' || !decision.destination) return;

      try {
        switch (decision.code) {
          case RedirectCode.AUTHENTICATED_WITH_ACCOUNT: {
            const data = {
              accountId: decision.data?.accountId as string,
              redirectUrl: decision.destination,
            };
            if (handlers.onAuthenticatedWithAccount) {
              handlers.onAuthenticatedWithAccount(data, () => navigateToUrl(data.redirectUrl));
            } else {
              navigateToUrl(data.redirectUrl);
            }
            break;
          }
          case RedirectCode.ACCOUNT_SELECTION_REQUIRED: {
            if (handlers.onAccountSelectionRequired) {
              handlers.onAccountSelectionRequired(() => navigateToUrl(redirectUrls.accounts));
            } else {
              navigateToUrl(redirectUrls.accounts);
            }
            break;
          }
          case RedirectCode.NO_AUTHENTICATION: {
            if (handlers.onNoAuthentication) {
              handlers.onNoAuthentication(() => navigateToUrl(redirectUrls.login));
            } else {
              navigateToUrl(redirectUrls.login);
            }
            break;
          }
          case RedirectCode.ACCOUNT_DATA_LOAD_FAILED: {
            const data = { accountId: decision.data?.accountId as string };
            if (handlers.onAccountDataLoadFailed) {
              handlers.onAccountDataLoadFailed(data, () => navigateToUrl(redirectUrls.accounts));
            } else {
              navigateToUrl(redirectUrls.accounts);
            }
            break;
          }
          default: {
            navigateToUrl(decision.destination);
            break;
          }
        }
      } catch (error) {
        navigateToUrl(decision.destination);
      }
    },
    [
      handlers.onAuthenticatedWithAccount,
      handlers.onAccountSelectionRequired,
      handlers.onNoAuthentication,
      handlers.onAccountDataLoadFailed,
      navigateToUrl,
      redirectUrls,
    ],
  );

  const handleRedirect = useCallback(() => {
    const decision = getRedirectDecision();
    executeRedirect(decision);
  }, [getRedirectDecision, executeRedirect]);

  return {
    handleRedirect,
    getRedirectDecision,
    isReady: redirectDecision.action !== 'wait',
    redirectCode: redirectDecision.code,
  };
};
