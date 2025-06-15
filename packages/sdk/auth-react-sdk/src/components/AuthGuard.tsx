import React, { JSX } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LoadingState } from '../types';
import DefaultLoadingSpinner from './DefaultLoadingSpinner';
import DefaultGlobalErrorDisplay from './DefaultGlobalErrorDisplay';
import DefaultErrorDisplay from './DefaultErrorDisplay';

// Base props that are always available
interface BaseAuthGuardProps {
  children?: React.ReactNode;
  redirectDelay?: number;

  // Customizable UI components
  loadingComponent?: React.ComponentType<{
    reason?: string;
    loadingState?: LoadingState;
  }>;
  redirectingComponent?: React.ComponentType<{
    destination: string;
    delay?: number;
    reason?: string;
  }>;
  errorComponent?: React.ComponentType<{
    error: string;
    loadingState?: LoadingState;
    retry?: () => void;
  }>;
  globalErrorComponent?: React.ComponentType<{
    error: string;
    clearError?: () => void;
    retry?: () => void;
  }>;
}

// Rule 1: allowGuests: true, requireAccount: false
// Only redirectOnAuthenticated is allowed (disabled if children present)
interface GuestNoAccountProps extends BaseAuthGuardProps {
  allowGuests: true;
  requireAccount: false;
  redirectOnAuthenticated?: string;
  // Explicitly forbid these props
  redirectToLogin?: never;
  redirectToAccountSelection?: never;
}

// Rule 2: allowGuests: true, requireAccount: true
// All redirect props are allowed
interface GuestWithAccountProps extends BaseAuthGuardProps {
  allowGuests: true;
  requireAccount: true;
  redirectOnAuthenticated?: string;
  redirectToLogin?: string;
  redirectToAccountSelection?: string;
}

// Rule 3: allowGuests: false, requireAccount: true
// All props allowed except redirectOnAuthenticated is disabled if children present
interface ProtectedWithAccountProps extends BaseAuthGuardProps {
  allowGuests: false;
  requireAccount: true;
  redirectOnAuthenticated?: string;
  redirectToLogin?: string;
  redirectToAccountSelection?: string;
}

// Rule 4: allowGuests: false, requireAccount: false
// This combination should cause a compilation error
interface InvalidCombinationProps extends BaseAuthGuardProps {
  allowGuests: false;
  requireAccount: false;
  // Force a compilation error with never types
  _error: 'Invalid combination: allowGuests: false and requireAccount: false is not allowed. Use allowGuests: true with requireAccount: false instead.';
}

// Union type that enforces all the rules
type AuthGuardProps = GuestNoAccountProps | GuestWithAccountProps | ProtectedWithAccountProps | InvalidCombinationProps;

export function AuthGuard(props: AuthGuardProps): JSX.Element | null {
  const {
    children,
    redirectDelay,
    loadingComponent: LoadingComponent,
    redirectingComponent: RedirectingComponent,
    errorComponent: ErrorComponent,
    globalErrorComponent: GlobalErrorComponent,
  } = props;

  // Extract props safely based on the type
  const allowGuests = 'allowGuests' in props ? props.allowGuests : false;
  const requireAccount = 'requireAccount' in props ? props.requireAccount : false;
  const redirectOnAuthenticated = 'redirectOnAuthenticated' in props ? props.redirectOnAuthenticated : undefined;
  const redirectToLogin = 'redirectToLogin' in props ? props.redirectToLogin : undefined;
  const redirectToAccountSelection =
    'redirectToAccountSelection' in props ? props.redirectToAccountSelection : undefined;

  const session = useAppStore((state) => state.session);

  // Derive authentication state from session
  const isAuthenticated = session.hasSession && session.isValid && session.accountIds.length > 0;
  const loadingState = session.loadingState;

  // Wait for session to be ready before making auth decisions
  if (loadingState === LoadingState.IDLE) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Initializing session" loadingState={loadingState} />;
    }

    return <DefaultLoadingSpinner message="Initializing..." />;
  }

  // Show loading state
  if (loadingState === LoadingState.LOADING) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Loading session" loadingState={loadingState} />;
    }

    return <DefaultLoadingSpinner message="Loading..." />;
  }

  // Show error state if session has error
  if (loadingState === LoadingState.ERROR || session.error) {
    if (ErrorComponent) {
      return (
        <ErrorComponent
          error={session.error || 'Authentication error'}
          loadingState={loadingState}
          retry={() => window.location.reload()}
        />
      );
    }

    return (
      <DefaultErrorDisplay error={session.error || 'Authentication error'} retry={() => window.location.reload()} />
    );
  }

  // Session is ready - now handle auth logic
  if (loadingState === LoadingState.READY) {
    // Handle guest pages (login, signup, forgot password)
    if (allowGuests) {
      if (isAuthenticated && !children) {
        if (redirectOnAuthenticated) {
          // Authenticated user on guest page - redirect them away (only if no children)
          if (RedirectingComponent) {
            return (
              <RedirectingComponent
                destination={redirectOnAuthenticated}
                delay={redirectDelay}
                reason="User already authenticated"
              />
            );
          }

          if (typeof window !== 'undefined') {
            window.location.href = redirectOnAuthenticated;
          }

          return <DefaultLoadingSpinner message="Redirecting..." />;
        }

        throw new Error('redirectOnAuthenticated url is needed');
      }

      // Allow guests (authenticated or not) to see the page
      return <>{children}</>;
    }

    // Handle protected pages (allowGuests: false)
    if (!allowGuests) {
      // User not authenticated
      if (!isAuthenticated) {
        if (redirectToLogin) {
          if (RedirectingComponent) {
            return (
              <RedirectingComponent
                destination={redirectToLogin}
                delay={redirectDelay}
                reason="User not authenticated"
              />
            );
          }

          if (typeof window !== 'undefined') {
            window.location.href = redirectToLogin;
          }

          return <DefaultLoadingSpinner message="Redirecting to login..." />;
        }

        // No redirect URL provided - just show children or error
        throw new Error('redirectToLogin url is needed');
      }

      // User authenticated but account selection required
      if (requireAccount && !session.currentAccountId) {
        if (redirectToAccountSelection) {
          if (RedirectingComponent) {
            return (
              <RedirectingComponent
                destination={redirectToAccountSelection}
                delay={redirectDelay}
                reason="Account selection required"
              />
            );
          }

          if (typeof window !== 'undefined') {
            window.location.href = redirectToAccountSelection;
          }

          return <DefaultLoadingSpinner message="Redirecting to account selection..." />;
        }

        throw new Error('redirectToAccountSelection url is needed');
      }

      // Handle redirect-only pages (no children) - redirect on success
      if (!children && redirectOnAuthenticated) {
        if (RedirectingComponent) {
          return (
            <RedirectingComponent
              destination={redirectOnAuthenticated}
              delay={redirectDelay}
              reason="Authentication successful"
            />
          );
        }

        if (typeof window !== 'undefined') {
          window.location.href = redirectOnAuthenticated;
        }

        return <DefaultLoadingSpinner message="Redirecting..." />;
      }

      // All checks passed - show protected content
      return <>{children}</>;
    }
  }

  // Fallback - unexpected state, show error
  return (
    <DefaultGlobalErrorDisplay
      error="AuthGuard reached an unexpected state. Please check your configuration."
      retry={() => window.location.reload()}
    />
  );
}
