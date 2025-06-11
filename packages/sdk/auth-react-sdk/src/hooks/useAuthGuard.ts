import { useMemo } from 'react';
import { useAuth } from './useAuth';

export enum AuthGuardDecision {
  LOADING = 'loading',
  SHOW_CONTENT = 'show_content',
  REDIRECT_TO_LOGIN = 'redirect_to_login',
  REDIRECT_TO_ACCOUNTS = 'redirect_to_accounts',
  REDIRECT_CUSTOM = 'redirect_custom',
}

export interface UseAuthGuardOptions {
  requireAccount?: boolean;
  requireEmailVerified?: boolean;
  allowGuests?: boolean;
  customRedirects?: {
    loginUrl?: string;
    accountsUrl?: string;
    customUrl?: string;
  };
}

export const useAuthGuard = (options: UseAuthGuardOptions = {}) => {
  const { requireAccount = true, requireEmailVerified = false, allowGuests = false, customRedirects = {} } = options;

  const { session, currentAccount, isAuthenticated } = useAuth();

  const decision = useMemo(() => {
    if (session.isLoading) {
      return {
        decision: AuthGuardDecision.LOADING,
        reason: 'Loading session',
      };
    }

    if (allowGuests && !session.hasSession) {
      return {
        decision: AuthGuardDecision.SHOW_CONTENT,
        reason: 'Guest access allowed',
      };
    }

    if (!isAuthenticated) {
      return {
        decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
        destination: customRedirects.loginUrl || '/login',
        reason: 'User not authenticated',
      };
    }

    if (requireAccount && !session.currentAccountId) {
      return {
        decision: AuthGuardDecision.REDIRECT_TO_ACCOUNTS,
        destination: customRedirects.accountsUrl || '/accounts',
        reason: 'Account selection required',
      };
    }

    if (requireEmailVerified && currentAccount && !currentAccount.userDetails.emailVerified) {
      return {
        decision: AuthGuardDecision.REDIRECT_CUSTOM,
        destination: customRedirects.customUrl || '/verify-email',
        reason: 'Email verification required',
      };
    }

    return {
      decision: AuthGuardDecision.SHOW_CONTENT,
      reason: 'Authentication checks passed',
    };
  }, [
    session.isLoading,
    session.hasSession,
    session.currentAccountId,
    isAuthenticated,
    currentAccount,
    allowGuests,
    requireAccount,
    requireEmailVerified,
    customRedirects,
  ]);

  return {
    decision: decision.decision,
    isLoading: decision.decision === AuthGuardDecision.LOADING,
    redirectDestination: decision.destination,
    redirectReason: decision.reason,
    currentAccount,
  };
};
