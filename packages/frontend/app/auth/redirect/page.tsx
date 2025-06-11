'use client';

import { useEffect } from 'react';
import { useAuthRedirectHandler, RedirectCode } from '../../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';

export default function AuthRedirect() {
  const config = getEnvironmentConfig();

  // Use the auth redirect handler with minimal configuration
  // All redirect logic is handled by the SDK's default handlers
  const { redirectCode, handleRedirect } = useAuthRedirectHandler({
    defaultHomeUrl: config.homeUrl || '/dashboard',
    defaultLoginUrl: '/login',
    defaultAccountsUrl: '/accounts',

    // Custom handlers (optional - using defaults)
    onAuthenticatedWithAccount: (data, defaultHandler) => {
      console.log('Authenticated with account:', data.accountId);
      defaultHandler(); // Use SDK default behavior
    },

    onAccountSelectionRequired: (defaultHandler) => {
      console.log('Account selection required');
      defaultHandler(); // Use SDK default behavior
    },

    onNoAuthentication: (defaultHandler) => {
      console.log('No authentication');
      defaultHandler(); // Use SDK default behavior
    },

    onAccountDataLoadFailed: (data, defaultHandler) => {
      console.log('Account data load failed:', data.accountId);
      defaultHandler(); // Use SDK default behavior
    },
  });

  // Auto-execute redirect on mount
  useEffect(() => {
    handleRedirect();
  }, []);

  // Get user-friendly message based on redirect code
  const getStatusMessage = (code: RedirectCode | null): string => {
    switch (code) {
      case RedirectCode.LOADING_AUTH_STATE:
        return 'Loading authentication state...';
      case RedirectCode.LOADING_ACCOUNT_DATA:
        return 'Loading account data...';
      case RedirectCode.AUTHENTICATED_WITH_ACCOUNT:
        return 'Redirecting to dashboard...';
      case RedirectCode.ACCOUNT_SELECTION_REQUIRED:
        return 'Redirecting to account selection...';
      case RedirectCode.NO_AUTHENTICATION:
        return 'Redirecting to login...';
      case RedirectCode.ACCOUNT_DATA_LOAD_FAILED:
        return 'Account data failed to load, redirecting...';
      case RedirectCode.HAS_ACCOUNTS_BUT_NONE_ACTIVE:
        return 'Redirecting to account selection...';
      default:
        return 'Redirecting...';
    }
  };

  // Show loading spinner while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{getStatusMessage(redirectCode)}</p>
        {redirectCode && <p className="text-xs text-muted-foreground/70">Code: {redirectCode}</p>}
      </div>
    </div>
  );
}
