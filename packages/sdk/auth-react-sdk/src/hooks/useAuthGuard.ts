import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccount } from './useAccount';
import { Account, AuthGuardDecision, LoadingInfo } from '../types';

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
   * If provided, the default redirect is NOT automatically executed
   * Call the defaultRedirect function to perform the default behavior
   */
  onRedirect?: (
    destination: string,
    decision: AuthGuardDecision,
    defaultRedirect: () => void,
  ) => void;

  /**
   * Callback that runs on every decision change
   * Called whenever decision, destination, or reason changes
   */
  onDecisionChange?: (
    decision: AuthGuardDecision,
    destination?: string,
    reason?: string,
  ) => void;

  /**
   * Whether to automatically redirect or manual control
   * @default true
   */
  autoRedirect?: boolean;

  /**
   * Delay before redirecting (in milliseconds)
   * Useful to prevent flashing content
   * @default 0
   */
  redirectDelay?: number;
}

export interface AuthGuardResult {
  /**
   * The current auth decision
   */
  decision: AuthGuardDecision;

  /**
   * Whether auth checks are complete (not loading)
   */
  isLoading: boolean;

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

  hasError: boolean;

  loadingInfo: LoadingInfo;

  /**
   * Manual redirect function
   */
  redirect: (destination: string) => void;

  /**
   * Check if content should be shown
   */
  forceShowContent: () => boolean;
}

interface AuthDecisionResult {
  decision: AuthGuardDecision;
  destination?: string;
  reason?: string;
}

export const useAuthGuard = (
  options: AuthGuardOptions = {},
): AuthGuardResult => {
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

  // Get auth state from SDK
  const {
    isAuthenticated,
    hasValidSession,
    currentAccount: currentAccountFromStore,
    isReady: isAuthReady,
    accounts,
  } = useAuth();

  // Get current account data if we have an account ID
  const {
    account: currentAccount,
    isReady: isAccountReady,
    hasError,
    loadingInfo,
  } = useAccount(currentAccountFromStore?.id, {
    refreshOnMount: true,
  });

  const isReady = isAuthReady && isAccountReady;

  // State to store the current auth decision
  const [authDecision, setAuthDecision] = useState<AuthDecisionResult>({
    decision: AuthGuardDecision.LOADING,
    reason: 'Initializing authentication',
  });

  const { decision, destination, reason } = authDecision;

  // Manual redirect function
  const redirect = useCallback((destination: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = destination;
    }
  }, []);

  // Force show content function (for manual override)
  const forceShowContent = useCallback(() => {
    return decision === AuthGuardDecision.SHOW_CONTENT;
  }, [decision]);

  // Callback for decision changes - runs on every decision/destination/reason change
  useEffect(() => {
    if (onDecisionChange) {
      onDecisionChange(decision, destination, reason);
    }
  }, [decision, destination, reason]);

  // Auto-redirect effect with improved logic
  useEffect(() => {
    // Don't redirect if auto-redirect is disabled
    if (!autoRedirect || !isReady || hasError) return;

    // Don't redirect if still loading or showing content
    if (
      decision === AuthGuardDecision.LOADING ||
      decision === AuthGuardDecision.SHOW_CONTENT
    ) {
      return;
    }

    // Only redirect for actual redirect decisions with destinations
    if (
      destination &&
      (decision === AuthGuardDecision.REDIRECT_TO_LOGIN ||
        decision === AuthGuardDecision.REDIRECT_TO_ACCOUNTS ||
        decision === AuthGuardDecision.REDIRECT_CUSTOM)
    ) {
      const performRedirect = () => {
        // Create default redirect function
        const defaultRedirect = () => redirect(destination);

        if (onRedirect) {
          // Call onRedirect with default redirect function - user controls if/when to redirect
          onRedirect(destination, decision, defaultRedirect);
        } else {
          // No custom handler - perform default redirect
          defaultRedirect();
        }
      };

      // Apply delay if specified
      if (redirectDelay > 0) {
        const timer = setTimeout(performRedirect, redirectDelay);
        return () => clearTimeout(timer);
      } else {
        performRedirect();
      }
    }
  }, [decision]);

  // Effect to calculate and update auth decision when dependencies change
  useEffect(() => {
    const calculateAuthDecision = (): AuthDecisionResult => {
      if (hasError) {
        return {
          decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
          destination: customRedirects.loginUrl || '/login',
          reason: 'User not authenticated',
        };
      }

      // Still loading auth state - wait before making any decisions
      if (!isReady) {
        return {
          decision: AuthGuardDecision.LOADING,
          reason: 'Loading authentication state',
        };
      }

      // Allow guests and no valid session
      if (allowGuests && !hasValidSession) {
        return {
          decision: AuthGuardDecision.SHOW_CONTENT,
          reason: 'Guest access allowed',
        };
      }

      // No valid session or not authenticated
      if (!hasValidSession || !isAuthenticated || accounts.length === 0) {
        return {
          decision: AuthGuardDecision.REDIRECT_TO_LOGIN,
          destination: customRedirects.loginUrl || '/login',
          reason: 'User not authenticated',
        };
      }

      // Require account but none selected
      if (requireAccount && (!currentAccountFromStore || !currentAccount)) {
        return {
          decision: AuthGuardDecision.REDIRECT_TO_ACCOUNTS,
          destination: customRedirects.accountsUrl || '/accounts',
          reason: 'Account data failed to load',
        };
      }

      // Email verification required (only check when we have account data)
      if (
        requireEmailVerified &&
        currentAccount &&
        !currentAccount.userDetails.emailVerified
      ) {
        return {
          decision: AuthGuardDecision.REDIRECT_CUSTOM,
          destination: customRedirects.customUrl || '/verify-email',
          reason: 'Email verification required',
        };
      }

      // All checks passed - show content
      return {
        decision: AuthGuardDecision.SHOW_CONTENT,
        reason: 'Authentication checks passed',
      };
    };

    const newDecision = calculateAuthDecision();
    setAuthDecision(newDecision);
  }, [isReady, hasError]);

  return {
    decision,
    isLoading: decision !== AuthGuardDecision.LOADING,
    redirectDestination: destination,
    redirectReason: reason,
    currentAccount,
    redirect,
    forceShowContent,
    hasError,
    loadingInfo,
  };
};
