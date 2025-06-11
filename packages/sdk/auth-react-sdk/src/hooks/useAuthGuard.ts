import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  AuthGuardDecision,
  AccountSessionInfo,
  Account,
  LoadingInfo,
} from '../types';
import { useAuthStore } from '../store/authStore';

export interface AuthGuardOptions {
  requireAccount?: boolean;
  requireEmailVerified?: boolean;
  allowGuests?: boolean;
  customRedirects?: {
    loginUrl?: string;
    accountsUrl?: string;
    customUrl?: string;
  };
  onRedirect?: (
    destination: string,
    decision: AuthGuardDecision,
    defaultRedirect: () => void,
  ) => void;
  onDecisionChange?: (
    decision: AuthGuardDecision,
    destination?: string,
    reason?: string,
  ) => void;
  autoRedirect?: boolean;
  redirectDelay?: number;
}

const calculateAuthDecision = (
  session: AccountSessionInfo | null,
  accounts: Account[],
  currentAccount: Account | null,
  options: AuthGuardOptions,
): { decision: AuthGuardDecision; destination?: string; reason?: string } => {
  if (options.allowGuests && !session?.hasSession) {
    return {
      decision: AuthGuardDecision.SHOW_CONTENT,
      reason: 'Guest access allowed',
    };
  }

  if (!session?.hasSession || !session?.isValid || accounts.length === 0) {
    return {
      decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
      destination: options.customRedirects?.loginUrl || '/login',
      reason: 'User not authenticated',
    };
  }

  if (options.requireAccount && !session?.currentAccountId) {
    return {
      decision: AuthGuardDecision.REDIRECT_TO_ACCOUNTS,
      destination: options.customRedirects?.accountsUrl || '/accounts',
      reason: 'Account selection required',
    };
  }

  if (
    options.requireEmailVerified &&
    currentAccount &&
    !currentAccount.userDetails.emailVerified
  ) {
    return {
      decision: AuthGuardDecision.REDIRECT_CUSTOM,
      destination: options.customRedirects?.customUrl || '/verify-email',
      reason: 'Email verification required',
    };
  }

  return {
    decision: AuthGuardDecision.SHOW_CONTENT,
    reason: 'Authentication checks passed',
  };
};

export const useAuthGuard = (options: AuthGuardOptions = {}) => {
  const {
    requireAccount = true,
    requireEmailVerified = false,
    allowGuests = false,
    customRedirects = {},
    onRedirect,
    onDecisionChange,
    autoRedirect = true,
    redirectDelay = 0,
  } = options;

  const store = useAuthStore();
  const session = store.session;
  const accounts = store.getAccounts();
  const currentAccount = store.getCurrentAccount();
  const hasError = !!store.getError('auth');
  const loadingInfo = store.getLoadingState('auth') || {
    state: 'ready',
    reason: 'Authentication ready',
  };

  const [authDecision, setAuthDecision] = useState<{
    decision: AuthGuardDecision;
    destination?: string;
    reason?: string;
  }>({
    decision: AuthGuardDecision.LOADING,
    reason: 'Initializing authentication',
  });

  const { decision, destination, reason } = authDecision;

  const redirect = useCallback((destination: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = destination;
    }
  }, []);

  const forceShowContent = useCallback(() => {
    return decision === AuthGuardDecision.SHOW_CONTENT;
  }, [decision]);

  const memoizedOptions = useMemo(
    () => ({
      requireAccount,
      requireEmailVerified,
      allowGuests,
      customRedirects,
    }),
    [requireAccount, requireEmailVerified, allowGuests, customRedirects],
  );

  useEffect(() => {
    if (hasError) {
      setAuthDecision({
        decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
        destination: customRedirects.loginUrl || '/login',
        reason: 'Authentication error occurred',
      });
      return;
    }

    const newDecision = calculateAuthDecision(
      session,
      accounts,
      currentAccount,
      memoizedOptions,
    );

    setAuthDecision(newDecision);
  }, [
    session,
    accounts,
    currentAccount,
    memoizedOptions,
    hasError,
    customRedirects.loginUrl,
  ]);

  useEffect(() => {
    if (onDecisionChange) {
      onDecisionChange(decision, destination, reason);
    }
  }, [decision, destination, reason]);

  useEffect(() => {
    if (!autoRedirect) return;

    if (
      decision === AuthGuardDecision.LOADING ||
      decision === AuthGuardDecision.SHOW_CONTENT
    ) {
      return;
    }

    if (
      destination &&
      (decision === AuthGuardDecision.REDIRECT_TO_LOGIN ||
        decision === AuthGuardDecision.REDIRECT_TO_ACCOUNTS ||
        decision === AuthGuardDecision.REDIRECT_CUSTOM)
    ) {
      const performRedirect = () => {
        const defaultRedirect = () => redirect(destination);

        if (onRedirect) {
          onRedirect(destination, decision, defaultRedirect);
        } else {
          defaultRedirect();
        }
      };

      if (redirectDelay > 0) {
        const timer = setTimeout(performRedirect, redirectDelay);
        return () => clearTimeout(timer);
      } else {
        performRedirect();
      }
    }
  }, [autoRedirect, decision, destination, redirectDelay]);

  return {
    decision,
    isLoading: decision === AuthGuardDecision.LOADING,
    redirectDestination: destination,
    redirectReason: reason,
    currentAccount,
    redirect,
    forceShowContent,
    hasError,
    loadingInfo,
  };
};
