'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Shield, Key, Calendar, Mail, User, LogOut, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/auth/user-avatar';
import { AuthGuard, useSession } from '../../../sdk/auth-react-sdk/src';
import { formatAccountName } from '@/lib/utils';
import { LoadingSpinner } from '@/components/auth/loading-spinner';
import { ErrorDisplay } from '@/components/auth/error-display';
import { RedirectingDisplay } from '@/components/auth/redirecting-display';

export default function DashboardPage() {
  const router = useRouter();
  const { session, currentAccount, accounts, operations } = useSession();

  // Load session on mount
  useEffect(() => {
    if (session.isIdle && !session.data) {
      operations.load();
    }
  }, [session.isIdle, session.data, operations]);

  // Load current account data if available
  useEffect(() => {
    if (currentAccount && currentAccount.isIdle && !currentAccount.data) {
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

  const renderQuickActions = () => (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Manage your account and security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="justify-start h-auto p-4" onClick={handleAccountSettings}>
            <Settings className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Account Settings</div>
              <div className="text-sm text-muted-foreground">Update your profile and preferences</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto p-4"
            onClick={() => router.push(`/accounts/${currentAccount?.id}/security`)}
          >
            <Shield className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Security Settings</div>
              <div className="text-sm text-muted-foreground">Manage 2FA and password</div>
            </div>
          </Button>

          {currentAccount?.data?.accountType === 'oauth' && (
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => router.push(`/accounts/${currentAccount?.id}/tokens`)}
            >
              <Key className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Token Management</div>
                <div className="text-sm text-muted-foreground">View and manage OAuth tokens</div>
              </div>
            </Button>
          )}

          {accounts.length > 1 && (
            <Button variant="outline" className="justify-start h-auto p-4" onClick={handleSwitchAccounts}>
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Switch Account</div>
                <div className="text-sm text-muted-foreground">Switch between your {accounts.length} accounts</div>
              </div>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderRecentActivity = () => (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest account activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <div className="flex-1">
              <p className="text-sm font-medium">Signed in successfully</p>
              <p className="text-xs text-muted-foreground">Just now</p>
            </div>
          </div>

          {currentAccount?.data && (
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-medium">Account created</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(currentAccount.data.created).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectToLogin="/login"
      redirectToAccountSelection="/accounts"
      loadingComponent={LoadingSpinner}
      redirectingComponent={RedirectingDisplay}
      errorComponent={ErrorDisplay}
      session={{
        data: session.data,
        loading: session.isLoading,
        error: session.error,
      }}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quick Actions */}
              {renderQuickActions()}

              {/* Recent Activity */}
              {renderRecentActivity()}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
