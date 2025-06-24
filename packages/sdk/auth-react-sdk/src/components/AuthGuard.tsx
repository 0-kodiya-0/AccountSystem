import React, { JSX } from 'react';
import { useSession } from '../hooks/useSession';
import DefaultLoadingSpinner from './DefaultLoadingSpinner';
import DefaultGlobalErrorDisplay from './DefaultGlobalErrorDisplay';
import DefaultErrorDisplay from './DefaultErrorDisplay';
import { useConfig } from '../context/ServicesProvider';

interface BaseAuthGuardProps {
  children?: React.ReactNode;

  // Optional operation states
  switchingAccount?: {
    loading: boolean;
    error: string | null;
  };

  // Component customization
  redirectDelay?: number;
  loadingComponent?: React.ComponentType<{
    reason?: string;
    loading?: boolean;
  }>;
  redirectingComponent?: React.ComponentType<{
    destination: string;
    delay?: number;
    reason?: string;
  }>;
  errorComponent?: React.ComponentType<{
    error: string;
    loading?: boolean;
    retry?: () => void;
  }>;
  globalErrorComponent?: React.ComponentType<{
    error: string;
    clearError?: () => void;
    retry?: () => void;
  }>;

  // Session loading options
  autoLoadSession?: boolean; // Whether to auto-load session (default: true)
}

interface GuestNoAccountProps extends BaseAuthGuardProps {
  allowGuests: true;
  requireAccount: false;
  redirectOnAuthenticated?: string;
  redirectToLogin?: never;
  redirectToAccountSelection?: never;
}

interface GuestWithAccountProps extends BaseAuthGuardProps {
  allowGuests: true;
  requireAccount: true;
  redirectOnAuthenticated?: string;
  redirectToLogin?: string;
  redirectToAccountSelection?: string;
}

interface ProtectedWithAccountProps extends BaseAuthGuardProps {
  allowGuests: false;
  requireAccount: true;
  redirectOnAuthenticated?: string;
  redirectToLogin?: string;
  redirectToAccountSelection?: string;
}

interface InvalidCombinationProps extends BaseAuthGuardProps {
  allowGuests: false;
  requireAccount: false;
  _error: 'Invalid combination: allowGuests: false and requireAccount: false is not allowed. Use allowGuests: true with requireAccount: false instead.';
}

type AuthGuardProps = GuestNoAccountProps | GuestWithAccountProps | ProtectedWithAccountProps | InvalidCombinationProps;

export function AuthGuard(props: AuthGuardProps): JSX.Element | null {
  const {
    children,
    switchingAccount,
    redirectDelay,
    loadingComponent: LoadingComponent,
    redirectingComponent: RedirectingComponent,
    errorComponent: ErrorComponent,
    globalErrorComponent: GlobalErrorComponent,
    autoLoadSession = true,
  } = props;

  const config = useConfig();

  const allowGuests = 'allowGuests' in props ? props.allowGuests : false;
  const requireAccount = 'requireAccount' in props ? props.requireAccount : false;
  const redirectOnAuthenticated = 'redirectOnAuthenticated' in props ? props.redirectOnAuthenticated : undefined;
  const redirectToLogin =
    'redirectToLogin' in props
      ? config.sdkConfig.frontendProxyUrl
        ? `${config.sdkConfig.frontendProxyUrl}${props.redirectToLogin}`
        : props.redirectToLogin
      : undefined;
  const redirectToAccountSelection =
    'redirectToAccountSelection' in props
      ? config.sdkConfig.frontendProxyUrl
        ? `${config.sdkConfig.frontendProxyUrl}${props.redirectToAccountSelection}`
        : props.redirectToAccountSelection
      : undefined;

  // Get session state using the new useSession hook
  const {
    error: sessionError,
    isAuthenticated,
    hasAccount,
    isIdle,
    isLoading: sessionLoading,
  } = useSession({ autoLoad: autoLoadSession });

  // FIXED: Proper children check using React.Children.count
  const hasChildren = React.Children.count(children) > 0;

  // Session is initializing (no data and loading)
  if (isIdle) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Initializing session" loading={true} />;
    }
    return <DefaultLoadingSpinner message="Initializing..." />;
  }

  // Session is loading
  if (sessionLoading) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Loading session" loading={true} />;
    }
    return <DefaultLoadingSpinner message="Loading..." />;
  }

  // Account switching in progress
  if (switchingAccount?.loading) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Switching account" loading={true} />;
    }
    return <DefaultLoadingSpinner message="Switching account..." />;
  }

  // Session has error
  if (sessionError) {
    if (ErrorComponent) {
      return <ErrorComponent error={sessionError} loading={false} retry={() => window.location.reload()} />;
    }
    return <DefaultErrorDisplay error={sessionError} retry={() => window.location.reload()} />;
  }

  // Account switching error
  if (switchingAccount?.error) {
    if (ErrorComponent) {
      return <ErrorComponent error={switchingAccount.error} loading={false} retry={() => window.location.reload()} />;
    }
    return <DefaultErrorDisplay error={switchingAccount.error} retry={() => window.location.reload()} />;
  }

  // Session is ready - handle auth logic
  // Handle guest pages (login, signup, forgot password)
  if (allowGuests) {
    // FIXED: Use hasChildren instead of !children
    if (isAuthenticated && !hasChildren) {
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

      console.error('redirectOnAuthenticated url is needed for guest page with authenticated user');
      return (
        <DefaultGlobalErrorDisplay
          error="Configuration error: redirectOnAuthenticated is required"
          retry={() => window.location.reload()}
        />
      );
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
            <RedirectingComponent destination={redirectToLogin} delay={redirectDelay} reason="User not authenticated" />
          );
        }

        if (typeof window !== 'undefined') {
          window.location.href = redirectToLogin;
        }

        return <DefaultLoadingSpinner message="Redirecting to login..." />;
      }

      console.error('redirectToLogin url is needed for protected page');
      return (
        <DefaultGlobalErrorDisplay
          error="Configuration error: redirectToLogin is required"
          retry={() => window.location.reload()}
        />
      );
    }

    // User authenticated but account selection required
    if (requireAccount && !hasAccount) {
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

      console.error('redirectToAccountSelection url is needed when requireAccount is true');
      return (
        <DefaultGlobalErrorDisplay
          error="Configuration error: redirectToAccountSelection is required"
          retry={() => window.location.reload()}
        />
      );
    }

    // FIXED: Handle redirect-only pages (no children) - use hasChildren instead of !children
    if (!hasChildren && redirectOnAuthenticated) {
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

  // Fallback - unexpected state
  if (GlobalErrorComponent) {
    return (
      <GlobalErrorComponent
        error="AuthGuard reached an unexpected state. Please check your configuration."
        retry={() => window.location.reload()}
      />
    );
  }

  return (
    <DefaultGlobalErrorDisplay
      error="AuthGuard reached an unexpected state. Please check your configuration."
      retry={() => window.location.reload()}
    />
  );
}
