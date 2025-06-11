'use client';

import { useAuth, AuthGuard } from '../../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { RedirectingSpinner } from '@/components/auth/redirecting-spinner';

export default function DashboardPage() {
  const { currentAccount } = useAuth();
  const config = getEnvironmentConfig();

  return (
    <AuthGuard requireAccount={true} loadingComponent={LoadingSpinner} redirectingComponent={RedirectingSpinner}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-foreground">Welcome to {config.appName}</h1>

            {currentAccount && (
              <div className="bg-card border rounded-lg p-6 max-w-md mx-auto">
                <h2 className="text-lg font-semibold mb-4">Current Account</h2>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Name:</strong> {currentAccount.userDetails.name}
                  </p>
                  <p>
                    <strong>Email:</strong> {currentAccount.userDetails.email}
                  </p>
                  <p>
                    <strong>Type:</strong> {currentAccount.accountType}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
