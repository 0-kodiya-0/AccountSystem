'use client';

import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { AuthGuard, useSession } from '../../sdk/auth-react-sdk/src';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import { ErrorDisplay } from '@/components/auth/error-display';

export default function RootPage() {
  const { session } = useSession();

  // This will redirect to our auth redirect handler
  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectDelay={0}
      redirectOnAuthenticated="/dashboard"
      redirectToAccountSelection="/accounts"
      redirectToLogin="/login"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
      session={{
        data: session.data,
        loading: session.isLoading,
        error: session.error,
      }}
    />
  );
}
