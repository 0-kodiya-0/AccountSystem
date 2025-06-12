import React, { JSX } from 'react';
import { useAuth } from '../hooks/useAuth';

// Base props that are always available
interface BaseAuthGuardProps {
  requireAccount?: boolean;
  customRedirects?: {
    loginUrl?: string;
    accountsUrl?: string;
  };

  // Customizable UI components
  loadingComponent?: React.ComponentType<{ reason?: string }>;
  redirectingComponent?: React.ComponentType<{
    destination: string;
    reason?: string;
  }>;
  errorComponent?: React.ComponentType<{
    error: string;
    retry?: () => void;
  }>;
}

// When allowGuests is true, children are required
interface AuthGuardPropsWithGuests extends BaseAuthGuardProps {
  children: React.ReactNode;
  allowGuests: true;
  redirectOnSuccess?: never; // Cannot redirect when allowing guests
}

// When redirectOnSuccess is provided, children are not needed
interface AuthGuardPropsWithRedirect extends BaseAuthGuardProps {
  children?: never;
  allowGuests?: false; // Cannot allow guests when redirecting
  redirectOnSuccess: string;
}

interface AuthGuardPropsWithNoRedirect extends BaseAuthGuardProps {
  children: React.ReactNode;
  allowGuests?: false;
  redirectOnSuccess?: never;
}

type AuthGuardProps = AuthGuardPropsWithGuests | AuthGuardPropsWithRedirect | AuthGuardPropsWithNoRedirect;

export function AuthGuard({
  children,
  requireAccount = true,
  allowGuests = false,
  redirectOnSuccess,
  customRedirects = {},
  loadingComponent: LoadingComponent,
  redirectingComponent: RedirectingComponent,
  errorComponent: ErrorComponent,
}: AuthGuardProps): JSX.Element | null {
  const { session, isAuthenticated } = useAuth();

  // Show loading state
  if (session.isLoading) {
    if (LoadingComponent) {
      return <LoadingComponent reason="Loading session" />;
    }

    // Default loading UI
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid #e2e8f0',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state if session has error
  if (session.error) {
    if (ErrorComponent) {
      return <ErrorComponent error={session.error} retry={() => window.location.reload()} />;
    }

    // Default error UI
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: '16px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#dc2626', fontSize: '16px', margin: '0 0 16px 0' }}>{session.error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Allow guests if specified and no session
  if (allowGuests && !session.hasSession) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    const loginUrl = customRedirects.loginUrl || '/login';

    if (RedirectingComponent) {
      return <RedirectingComponent destination={loginUrl} reason="User not authenticated" />;
    }

    // Default redirect or could trigger actual redirect
    if (typeof window !== 'undefined') {
      window.location.href = loginUrl;
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid #e2e8f0',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Redirecting to login...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Redirect to accounts if account selection required
  if (requireAccount && !session.currentAccountId) {
    const accountsUrl = customRedirects.accountsUrl || '/accounts';

    if (RedirectingComponent) {
      return <RedirectingComponent destination={accountsUrl} reason="Account selection required" />;
    }

    // Default redirect or could trigger actual redirect
    if (typeof window !== 'undefined') {
      window.location.href = accountsUrl;
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid #e2e8f0',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Redirecting to account selection...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // All checks passed, show content or redirect
  if (redirectOnSuccess) {
    if (RedirectingComponent) {
      return <RedirectingComponent destination={redirectOnSuccess} reason="Authentication successful" />;
    }

    // Redirect to success URL
    if (typeof window !== 'undefined') {
      window.location.href = redirectOnSuccess;
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid #e2e8f0',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Redirecting...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show content
  return <>{children}</>;
}
