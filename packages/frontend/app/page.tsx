'use client';

import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { AuthGuard } from '../../sdk/auth-react-sdk/src';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import { ErrorDisplay } from '@/components/auth/error-display';

export default function RootPage() {
  // This will redirect to our auth redirect handler
  return (
    <AuthGuard
      allowGuests={true}
      requireAccount={true}
      redirectDelay={0}
      redirectOnAuthenticated="/dashboard"
      redirectToAccountSelection="/accounts"
      redirectToLogin="/login"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    />
  );
}
