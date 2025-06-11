import { useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { RedirectCode } from '../types';

type RedirectHandlerWithDefault<T> = (
  data: T,
  defaultHandler: () => Promise<void>,
) => void | Promise<void>;
type RedirectHandlerWithoutData = (
  defaultHandler: () => Promise<void>,
) => void | Promise<void>;

interface UseAuthRedirectHandlerOptions {
  defaultHomeUrl: string;
  defaultLoginUrl: string;
  defaultAccountsUrl: string;
  autoRedirect?: boolean;
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

interface UseAuthRedirectHandlerReturn {
  handleRedirect: () => Promise<void>;
  getRedirectDecision: () => RedirectDecision;
  isReady: boolean;
  redirectCode: RedirectCode | null;
}

const calculateRedirectDecision = (
  hasValidSession: boolean,
  isAuthenticated: boolean,
  hasAccounts: boolean,
  currentAccountId: string | null,
  currentAccount: any,
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

export const useAuthRedirectHandler = (
  options: UseAuthRedirectHandlerOptions,
): UseAuthRedirectHandlerReturn => {
  const {
    defaultHomeUrl,
    defaultLoginUrl,
    defaultAccountsUrl,
    autoRedirect = true,
    ...handlers
  } = options;

  const store = useAuthStore();
  const hasValidSession = store.hasValidSession();
  const isAuthenticated = store.isAuthenticated();
  const currentAccountId = store.getCurrentAccountId();
  const currentAccount = store.getCurrentAccount();
  const accounts = store.getAccounts();

  const hasAccounts = useMemo(() => accounts.length > 0, [accounts.length]);

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

  const defaultAuthenticatedWithAccount = useCallback(
    async (data: { accountId: string; redirectUrl: string }) => {
      navigateToUrl(data.redirectUrl);
    },
    [navigateToUrl],
  );

  const defaultAccountSelectionRequired = useCallback(async () => {
    navigateToUrl(redirectUrls.accounts);
  }, [redirectUrls.accounts, navigateToUrl]);

  const defaultNoAuthentication = useCallback(async () => {
    navigateToUrl(redirectUrls.login);
  }, [redirectUrls.login, navigateToUrl]);

  const defaultAccountDataLoadFailed = useCallback(
    async (data: { accountId: string }) => {
      navigateToUrl(redirectUrls.accounts);
    },
    [redirectUrls.accounts, navigateToUrl],
  );

  const redirectDecision = useMemo(() => {
    return calculateRedirectDecision(
      hasValidSession,
      isAuthenticated,
      hasAccounts,
      currentAccountId,
      currentAccount,
      redirectUrls.home,
      redirectUrls.login,
      redirectUrls.accounts,
    );
  }, [
    hasValidSession,
    isAuthenticated,
    hasAccounts,
    currentAccountId,
    currentAccount,
    redirectUrls.home,
    redirectUrls.login,
    redirectUrls.accounts,
  ]);

  const getRedirectDecision = useCallback(
    () => redirectDecision,
    [redirectDecision],
  );

  const executeRedirect = useCallback(
    async (decision: RedirectDecision) => {
      if (decision.action !== 'redirect' || !decision.destination) return;

      try {
        switch (decision.code) {
          case RedirectCode.AUTHENTICATED_WITH_ACCOUNT: {
            const data = {
              accountId: decision.data?.accountId as string,
              redirectUrl: decision.destination,
            };
            if (handlers.onAuthenticatedWithAccount) {
              await handlers.onAuthenticatedWithAccount(data, () =>
                defaultAuthenticatedWithAccount(data),
              );
            } else {
              await defaultAuthenticatedWithAccount(data);
            }
            break;
          }
          case RedirectCode.ACCOUNT_SELECTION_REQUIRED: {
            if (handlers.onAccountSelectionRequired) {
              await handlers.onAccountSelectionRequired(
                defaultAccountSelectionRequired,
              );
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
              await handlers.onAccountDataLoadFailed(data, () =>
                defaultAccountDataLoadFailed(data),
              );
            } else {
              await defaultAccountDataLoadFailed(data);
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
      defaultAuthenticatedWithAccount,
      defaultAccountSelectionRequired,
      defaultNoAuthentication,
      defaultAccountDataLoadFailed,
      navigateToUrl,
    ],
  );

  const handleRedirect = useCallback(async () => {
    const decision = getRedirectDecision();
    await executeRedirect(decision);
  }, [getRedirectDecision, executeRedirect]);

  useEffect(() => {
    if (autoRedirect && redirectDecision.action === 'redirect') {
      executeRedirect(redirectDecision);
    }
  }, [autoRedirect, redirectDecision, executeRedirect]);

  return {
    handleRedirect,
    getRedirectDecision,
    isReady: redirectDecision.action !== 'wait',
    redirectCode: redirectDecision.code,
  };
};
