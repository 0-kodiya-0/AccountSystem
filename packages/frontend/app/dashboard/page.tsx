'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Shield, Calendar, User, LogOut, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { AuthGuard, useSession, useAccount } from '../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';
import TokenStatus from '@/components/dashboard/token-status';
import SecurityOverview from '@/components/dashboard/security-overview';

// Main Dashboard Component
export default function DashboardPage() {
  const router = useRouter();
  const { accounts } = useSession();
  const currentAccount = useAccount();

  // Load current account data if available and not loaded
  useEffect(() => {
    if (currentAccount && !currentAccount.data && currentAccount.isIdle) {
      currentAccount.operations.load();
    }
  }, [currentAccount]);

  const handleLogout = async () => {
    if (currentAccount) {
      await currentAccount.operations.logout();
    }
  };

  const handleSwitchAccounts = () => {
    router.push('/accounts');
  };

  const handleAccountSettings = () => {
    if (currentAccount) {
      router.push(`/accounts/${currentAccount.id}/settings`);
    }
  };

  const renderAccountInfo = () => {
    if (!currentAccount?.data) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 animate-pulse rounded-full" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-gray-200 animate-pulse rounded" />
                <div className="w-48 h-3 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const account = currentAccount.data;
    const displayName = formatAccountName(
      account.userDetails.firstName,
      account.userDetails.lastName,
      account.userDetails.name,
    );

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <UserAvatar name={displayName} imageUrl={account.userDetails.imageUrl} size="xl" />
              <div>
                <h2 className="text-2xl font-bold">{displayName}</h2>
                <p className="text-muted-foreground">{account.userDetails.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant={account.accountType === 'oauth' ? 'default' : 'secondary'}>
                    {account.accountType === 'oauth' ? account.provider : 'Local Account'}
                  </Badge>
                  <Badge variant="outline">{account.status}</Badge>
                  {account.security?.twoFactorEnabled && (
                    <Badge variant="outline" className="text-green-600">
                      <Shield className="w-3 h-3 mr-1" />
                      2FA Enabled
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleAccountSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              {accounts.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleSwitchAccounts}>
                  <Users className="w-4 h-4 mr-2" />
                  Switch Account
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAccountStats = () => {
    if (!currentAccount?.data) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-gray-200 animate-pulse rounded" />
                  <div className="w-16 h-6 bg-gray-200 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const account = currentAccount.data;
    const accountAge = Math.floor((Date.now() - new Date(account.created).getTime()) / (1000 * 60 * 60 * 24));

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Age</p>
                <p className="text-2xl font-bold">{accountAge} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Security</p>
                <p className="text-2xl font-bold">{account.security?.twoFactorEnabled ? 'Protected' : 'Basic'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account Type</p>
                <p className="text-2xl font-bold capitalize">{account.accountType}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectToLogin="/login"
      redirectToAccountSelection="/accounts"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your account.</p>
            </div>

            {/* Account Info */}
            {renderAccountInfo()}

            {/* Account Stats */}
            {renderAccountStats()}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                {/* Security Overview */}
                {currentAccount?.data && <SecurityOverview account={currentAccount.data} />}
              </div>

              {/* Right Column */}
              <div className="space-y-8">
                {/* Token Information */}
                {currentAccount?.id && <TokenStatus accountId={currentAccount.id} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
